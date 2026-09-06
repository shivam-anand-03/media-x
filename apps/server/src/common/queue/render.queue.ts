import { type Job } from "bullmq";
import { Types } from "mongoose";
import {
  canTransition,
  overallProgress,
  safeParseProjectDocument,
  type ExportStatus,
  type RenderStage,
} from "@workspace/motion";
import { BaseQueueService } from "../services/base-queue.service";
import { logger } from "../helper/logger";
import { envs } from "../configs/envs.config";
import { ExportJobModel, ProjectModel, ProjectStatus } from "@/core/models";
import { publishEvent } from "../helper/event-bus";
import { RenderService, RenderError } from "@/renderer/render.service";

/**
 * The video rendering queue (§30, §32).
 *
 * Rendering never happens inside an HTTP request: the API creates an
 * `ExportJob` row and enqueues its id, and this worker owns the whole
 * lifecycle. The job payload is intentionally just identifiers — the worker
 * re-reads the snapshot from the database so a job is safe to replay after a
 * restart and cannot carry a stale document in Redis.
 */

export interface RenderJobPayload {
  exportJobId: string;
  userId: string;
  projectId: string;
}

export const RENDER_QUEUE_NAME = "video-render";

export class RenderQueue extends BaseQueueService<RenderJobPayload> {
  constructor() {
    super(RENDER_QUEUE_NAME, envs.RENDER_CONCURRENCY);
  }

  async handler(job: Job<RenderJobPayload>): Promise<void> {
    const { exportJobId, userId } = job.data;

    const exportJob = await ExportJobModel.findById(exportJobId);
    if (!exportJob) {
      // The row was deleted while queued. Nothing to do, and retrying will
      // never help — swallow rather than burning attempts.
      logger.warn("Render job references a missing ExportJob", { exportJobId });
      return;
    }

    // Idempotency (§32): a replayed job must not restart a finished render.
    if (!canTransition(exportJob.status, "PROCESSING")) {
      logger.info("Skipping render for a job that is no longer startable", {
        exportJobId,
        status: exportJob.status,
      });
      return;
    }

    const emit = async (stage: RenderStage, stageProgress: number) => {
      const progress = overallProgress(stage, stageProgress);
      // Only persist meaningful movement — a frame-by-frame write would hammer
      // Mongo for 300 frames with no user-visible benefit.
      if (progress !== exportJob.progress || stage !== exportJob.stage) {
        exportJob.progress = progress;
        exportJob.stage = stage;
        await ExportJobModel.updateOne({ _id: exportJob._id }, { progress, stage }).catch(() => {});
      }
      this.publish(userId, {
        id: exportJobId,
        status: "PROCESSING" as ExportStatus,
        progress,
        stage,
      });
      await job.updateProgress(progress).catch(() => {});
    };

    try {
      await ExportJobModel.updateOne(
        { _id: exportJob._id },
        { status: "PROCESSING", startedAt: new Date(), progress: 0, stage: "validating" },
      );
      exportJob.status = "PROCESSING";
      this.publish(userId, { id: exportJobId, status: "PROCESSING", progress: 0, stage: "validating" });

      // Never trust the stored snapshot either — it was client-authored once.
      const parsed = safeParseProjectDocument(exportJob.projectSnapshot);
      if (!parsed.success) {
        throw new RenderError("INVALID_PROJECT", "Project snapshot failed schema validation", {
          issues: parsed.error.issues.slice(0, 10),
        });
      }
      await emit("validating", 1);

      const result = await RenderService.render({
        document: parsed.data,
        exportJobId,
        format: exportJob.format,
        quality: exportJob.quality,
        width: exportJob.width,
        height: exportJob.height,
        fps: exportJob.fps,
        userId,
        onProgress: emit,
      });

      // A cancel that landed mid-render wins: discard the output rather than
      // marking a cancelled job complete.
      const current = await ExportJobModel.findById(exportJobId).select("status").lean();
      if (current && current.status === "CANCELLED") {
        logger.info("Render finished for a cancelled job; discarding output", { exportJobId });
        await RenderService.discard(result.storagePath).catch(() => {});
        return;
      }

      await ExportJobModel.updateOne(
        { _id: exportJob._id },
        {
          status: "COMPLETED",
          progress: 100,
          stage: "finalizing",
          outputUrl: result.url,
          storagePath: result.storagePath,
          fileSize: result.size,
          completedAt: new Date(),
          errorCode: null,
          errorDetail: null,
        },
      );

      await ProjectModel.updateOne(
        { _id: new Types.ObjectId(job.data.projectId) },
        { status: ProjectStatus.EXPORTED },
      ).catch(() => {});

      this.publish(userId, {
        id: exportJobId,
        status: "COMPLETED",
        progress: 100,
        outputUrl: result.url,
        fileSize: result.size,
      });

      logger.info("Render completed", { exportJobId, size: result.size });
    } catch (error) {
      const code = error instanceof RenderError ? error.code : "UNKNOWN";
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);

      // Full detail server-side only; the client gets a code it can map to
      // friendly copy (§31).
      logger.error("Render failed", { exportJobId, code, detail });

      await ExportJobModel.updateOne(
        { _id: exportJobId },
        {
          status: "FAILED",
          errorCode: code,
          errorDetail: detail.slice(0, 4000),
          completedAt: new Date(),
        },
      ).catch(() => {});

      this.publish(userId, { id: exportJobId, status: "FAILED", progress: exportJob.progress, errorCode: code });

      // Rethrow so BullMQ records the failure; attempts are capped at 1 for
      // renders because a retry is an explicit, user-initiated new job.
      throw error;
    }
  }

  /** Fans progress out over the socket so the export dialog is live. */
  private publish(userId: string, payload: Record<string, unknown>) {
    try {
      publishEvent("EXPORT_PROGRESS", { userId, ...payload } as { userId: string });
    } catch {
      // The event bus is not initialised in worker-only processes. Polling in
      // the client covers this, so a missing socket must never fail a render.
    }
  }

  /** Enqueues a render. `jobId` is the export id, making enqueue idempotent. */
  public queueRender(payload: RenderJobPayload) {
    return this.addJob("render", payload, {
      jobId: `render_${payload.exportJobId}`,
      // Renders are expensive and long; a blind retry would double the cost of
      // a genuine failure. Retries are explicit user actions (§31).
      attempts: 1,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    });
  }

  /** Removes a still-waiting job so a cancel takes effect immediately. */
  public async cancelRender(exportJobId: string) {
    const job = await this.queue.getJob(`render_${exportJobId}`);
    if (!job) return false;
    const state = await job.getState();
    if (state === "waiting" || state === "delayed" || state === "prioritized") {
      await job.remove();
      return true;
    }
    return false;
  }
}

export default new RenderQueue();
