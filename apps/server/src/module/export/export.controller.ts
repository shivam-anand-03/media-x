import { Request, Response } from "express";
import { Types } from "mongoose";
import {
  canCancel,
  canRetry,
  createExportSchema,
  parseProjectDocument,
  resolveOutputSize,
  estimateRenderSeconds,
} from "@workspace/motion";
import { ApiResponse, AsyncHandler } from "@/common/utils/api-utils";
import { NotFoundError, ValidationError } from "@/common/utils/error-utils";
import { getAuth } from "@/common/helper/global";
import { logger } from "@/common/helper/logger";
import { ExportJobModel, type IExportJobDocument } from "@/core/models";
import { queueManager } from "@/common/queue/queue-manager";
import { RenderQueue, RENDER_QUEUE_NAME } from "@/common/queue/render.queue";
import { ProjectService } from "../project/project.service";

/**
 * Export orchestration (§29–§31).
 *
 * The handler's whole job is: validate, snapshot, persist a QUEUED row, enqueue.
 * Rendering itself never touches the request lifecycle.
 */
class ExportController {
  private get renderQueue(): RenderQueue {
    return queueManager.get<RenderQueue>(RENDER_QUEUE_NAME);
  }

  /** POST /v1/projects/:id/exports */
  createExportHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const body = createExportSchema.parse(req.body);
    const project = await ProjectService.getOwned(req.params.id as string, userId);

    // Validate before queueing: failing here gives an immediate, actionable
    // error instead of a job that dies in a worker minutes later.
    const document = parseProjectDocument(project.projectData);

    if (document.layers.length === 0) {
      throw new ValidationError("Add at least one element to your advertisement before exporting.");
    }

    // One active export per project keeps a user from queueing ten renders of
    // the same thing while the first is still running.
    const active = await ExportJobModel.findOne({
      projectId: project._id,
      status: { $in: ["QUEUED", "PROCESSING"] },
    }).lean();

    if (active) {
      throw new ValidationError("This project is already being exported. Wait for it to finish or cancel it first.", {
        error: "EXPORT_IN_PROGRESS",
        jobId: (active as any)._id?.toString(),
      });
    }

    const job = await this.enqueue({
      userId,
      projectId: project.id,
      document,
      format: body.format,
      quality: body.quality,
      fps: body.fps ?? document.canvas.fps,
      attempt: 1,
      rootJobId: null,
    });

    res.status(202).json(
      new ApiResponse("Export queued.", {
        ...job.toJSON(),
        estimatedSeconds: estimateRenderSeconds(document, body.quality),
      }),
    );
  });

  /** GET /v1/exports/:id */
  getExportHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const job = await this.getOwnedJob(req.params.id as string, userId);
    res.status(200).json(new ApiResponse("Export loaded.", job.toJSON()));
  });

  /** GET /v1/projects/:id/exports */
  listProjectExportsHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    await ProjectService.assertOwnership(req.params.id as string, userId);

    const jobs = await ExportJobModel.find({ projectId: ProjectService.toObjectId(req.params.id as string) })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json(new ApiResponse("Exports loaded.", { items: jobs.map((j) => j.toJSON()) }));
  });

  /**
   * POST /v1/exports/:id/retry
   * Creates a fresh attempt rather than reopening the failed row (§31), so the
   * history of a flaky render survives and the state machine stays acyclic.
   */
  retryExportHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const previous = await this.getOwnedJob(req.params.id as string, userId);

    if (!canRetry(previous.status)) {
      throw new ValidationError(
        previous.status === "COMPLETED"
          ? "This export already finished. Start a new export instead."
          : "This export is still running.",
      );
    }

    const project = await ProjectService.getOwned(previous.projectId.toString(), userId);
    // Re-snapshot from the live project: the user has probably fixed whatever
    // broke, and retrying the identical bad snapshot would just fail again.
    const document = parseProjectDocument(project.projectData);

    const job = await this.enqueue({
      userId,
      projectId: project.id,
      document,
      format: previous.format,
      quality: previous.quality,
      fps: previous.fps,
      attempt: previous.attempt + 1,
      rootJobId: previous.rootJobId ?? (previous._id as Types.ObjectId),
    });

    logger.info("Export retried", { previousJobId: previous.id, newJobId: job.id, attempt: job.attempt });
    res.status(202).json(new ApiResponse("Export restarted.", job.toJSON()));
  });

  /** POST /v1/exports/:id/cancel */
  cancelExportHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const job = await this.getOwnedJob(req.params.id as string, userId);

    if (!canCancel(job.status)) {
      throw new ValidationError("This export has already finished.");
    }

    // Mark cancelled first: if the job is mid-render the worker checks this
    // flag before publishing a result, so the output is discarded either way.
    await ExportJobModel.updateOne(
      { _id: job._id },
      { status: "CANCELLED", errorCode: "CANCELLED", completedAt: new Date() },
    );
    await this.renderQueue.cancelRender(job.id).catch(() => {});

    const updated = await ExportJobModel.findById(job._id);
    res.status(200).json(new ApiResponse("Export cancelled.", updated?.toJSON()));
  });

  // -------------------------------------------------------------------------

  private async enqueue(input: {
    userId: string;
    projectId: string;
    document: ReturnType<typeof parseProjectDocument>;
    format: "mp4" | "webm" | "gif";
    quality: "draft" | "standard" | "high" | "max";
    fps: number;
    attempt: number;
    rootJobId: Types.ObjectId | null;
  }): Promise<IExportJobDocument> {
    const { width, height } = resolveOutputSize(input.document, input.quality);

    const job = await ExportJobModel.create({
      userId: new Types.ObjectId(input.userId),
      projectId: new Types.ObjectId(input.projectId),
      status: "QUEUED",
      progress: 0,
      format: input.format,
      quality: input.quality,
      width,
      height,
      fps: input.fps,
      durationSeconds: input.document.canvas.duration,
      // Snapshot: the export describes the video that will exist, even after
      // the user keeps editing.
      projectSnapshot: input.document,
      attempt: input.attempt,
      rootJobId: input.rootJobId,
    });

    try {
      const queued = await this.renderQueue.queueRender({
        exportJobId: job.id,
        userId: input.userId,
        projectId: input.projectId,
      });
      job.queueJobId = queued.id ?? null;
      await job.save();
    } catch (error) {
      // Redis down, or no worker registered. Fail the row immediately so the
      // dialog shows a real error instead of a bar that never moves.
      logger.error("Could not enqueue render job", {
        exportJobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
      job.status = "FAILED";
      job.errorCode = "WORKER_UNAVAILABLE";
      job.errorDetail = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();
      await job.save();
    }

    return job;
  }

  private async getOwnedJob(id: string, userId: string): Promise<IExportJobDocument> {
    if (!Types.ObjectId.isValid(id)) throw new ValidationError("Invalid export id.");
    const job = await ExportJobModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    if (!job) throw new NotFoundError("Export not found.");
    return job;
  }
}

export default new ExportController();
