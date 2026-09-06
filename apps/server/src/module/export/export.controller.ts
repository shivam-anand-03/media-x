import path from "path";
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
import { logger } from "@/common/helper/logger";
import { ExportJobModel, ProjectModel, type IExportJobDocument } from "@/core/models";
import { cancelRender, startRender } from "@/renderer/render-runner";
import { ProjectService } from "../project/project.service";

/**
 * Export orchestration (§29–§31).
 *
 * The handler's whole job is: validate, snapshot, persist a QUEUED row, start
 * the render. Rendering itself never touches the request lifecycle — it runs in
 * the background and reports through the job row, which the client polls.
 */
/** Content types by export format, for the local streaming path. */
const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  gif: "image/gif",
};

/** A readable, filesystem-safe download name derived from the project. */
function buildDownloadName(projectName: string, format: string): string {
  const base =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "advertisement";
  return `${base}.${format}`;
}

class ExportController {
  /** POST /v1/projects/:id/exports */
  createExportHandler = AsyncHandler(async (req: Request, res: Response) => {
    const body = createExportSchema.parse(req.body);
    const project = await ProjectService.get(req.params.id as string);

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

    const job = await this.start({
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
    const job = await this.getJob(req.params.id as string);
    res.status(200).json(new ApiResponse("Export loaded.", job.toJSON()));
  });

  /** GET /v1/projects/:id/exports */
  listProjectExportsHandler = AsyncHandler(async (req: Request, res: Response) => {
    await ProjectService.assertExists(req.params.id as string);

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
    const previous = await this.getJob(req.params.id as string);

    if (!canRetry(previous.status)) {
      throw new ValidationError(
        previous.status === "COMPLETED"
          ? "This export already finished. Start a new export instead."
          : "This export is still running.",
      );
    }

    const project = await ProjectService.get(previous.projectId.toString());
    // Re-snapshot from the live project: the user has probably fixed whatever
    // broke, and retrying the identical bad snapshot would just fail again.
    const document = parseProjectDocument(project.projectData);

    const job = await this.start({
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
    const job = await this.getJob(req.params.id as string);

    if (!canCancel(job.status)) {
      throw new ValidationError("This export has already finished.");
    }

    // Mark cancelled first: if the job is mid-render the worker checks this
    // flag before publishing a result, so the output is discarded either way.
    await ExportJobModel.updateOne(
      { _id: job._id },
      { status: "CANCELLED", errorCode: "CANCELLED", completedAt: new Date() },
    );
    cancelRender(job.id);

    const updated = await ExportJobModel.findById(job._id);
    res.status(200).json(new ApiResponse("Export cancelled.", updated?.toJSON()));
  });

  /**
   * GET /v1/exports/:id/download
   *
   * The only way a rendered video leaves the system: the file is streamed from
   * disk with a Content-Disposition header, so /uploads never has to expose the
   * export tree directly.
   *
   * `?disposition=inline` is used by the dialog's Preview button.
   */
  downloadExportHandler = AsyncHandler(async (req: Request, res: Response) => {
    const job = await this.getJob(req.params.id as string);

    if (job.status !== "COMPLETED" || !job.storagePath) {
      throw new ValidationError("This export has not finished rendering yet.");
    }

    const disposition = req.query.disposition === "inline" ? "inline" : "attachment";
    const project = await ProjectModel.findById(job.projectId).select("name").lean();
    const filename = buildDownloadName(project?.name ?? "advertisement", job.format);

    const absolute = path.join(process.cwd(), "uploads", job.storagePath);
    // `res.download`/`sendFile` both 404 cleanly if the file vanished.
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.setHeader("Content-Type", CONTENT_TYPES[job.format] ?? "application/octet-stream");

    logger.info("Export download issued", { exportJobId: job.id, disposition });
    return res.sendFile(absolute, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ status: "failed", message: "The rendered file is no longer available." });
      }
    });
  });

  // -------------------------------------------------------------------------

  private async start(input: {
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

    // Runs in the background on this process; the row is the only channel back
    // to the client, so nothing is awaited here.
    startRender(job.id, input.projectId);

    return job;
  }

  private async getJob(id: string): Promise<IExportJobDocument> {
    if (!Types.ObjectId.isValid(id)) throw new ValidationError("Invalid export id.");
    const job = await ExportJobModel.findById(id);
    if (!job) throw new NotFoundError("Export not found.");
    return job;
  }
}

export default new ExportController();
