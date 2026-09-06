import { Types } from "mongoose";
import {
  canTransition,
  overallProgress,
  safeParseProjectDocument,
  type RenderStage,
} from "@workspace/motion";
import { logger } from "@/common/helper/logger";
import { envs } from "@/common/configs/envs.config";
import { ExportJobModel, ProjectModel, ProjectStatus } from "@/core/models";
import { RenderService, RenderError } from "./render.service";

/**
 * In-process render runner.
 *
 * Rendering still never happens inside an HTTP request: the API creates an
 * `ExportJob` row, hands the id to `startRender` and responds 202 immediately.
 * The work then runs here, on this process, writing progress to the job row —
 * which is the only thing the client ever reads (it polls `GET /v1/exports/:id`).
 *
 * The trade-off versus a real queue is deliberate and worth stating: jobs live
 * only as long as the process. A restart mid-render loses the render, so
 * `reconcileInterruptedJobs` marks orphans FAILED at boot rather than leaving a
 * progress bar that will never move again.
 */

/** Renders in flight or waiting for a slot, keyed by export job id. */
const inFlight = new Map<string, { cancelled: boolean }>();

/** Renders are heavy (a Chrome instance each), so only so many run at once. */
const MAX_CONCURRENT = Math.max(1, envs.RENDER_CONCURRENCY);
let active = 0;
const waiting: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
}

function releaseSlot(): void {
  active -= 1;
  waiting.shift()?.();
}

/**
 * Queues a render and returns immediately.
 *
 * Nothing is awaited on purpose — the caller is an HTTP handler that must not
 * block for the minutes a render takes. Failures are recorded on the job row,
 * so a rejected promise here would have nowhere useful to go.
 */
export function startRender(exportJobId: string, projectId: string): void {
  if (inFlight.has(exportJobId)) return; // Idempotent: never render the same job twice.
  inFlight.set(exportJobId, { cancelled: false });

  void run(exportJobId, projectId).catch((error) => {
    logger.error("Render runner crashed", {
      exportJobId,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
  });
}

/**
 * Flags a running render as cancelled. The runner checks this before it
 * publishes a result, so a render that finishes after the user cancels has its
 * output discarded rather than overwriting the CANCELLED row.
 */
export function cancelRender(exportJobId: string): boolean {
  const entry = inFlight.get(exportJobId);
  if (!entry) return false;
  entry.cancelled = true;
  return true;
}

/** True while a render is queued or running in this process. */
export function isRendering(exportJobId: string): boolean {
  return inFlight.has(exportJobId);
}

async function run(exportJobId: string, projectId: string): Promise<void> {
  await acquireSlot();

  try {
    const exportJob = await ExportJobModel.findById(exportJobId);
    if (!exportJob) {
      logger.warn("Render references a missing ExportJob", { exportJobId });
      return;
    }

    // The user may have cancelled while this was waiting for a slot.
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
      if (progress === exportJob.progress && stage === exportJob.stage) return;
      exportJob.progress = progress;
      exportJob.stage = stage;
      await ExportJobModel.updateOne({ _id: exportJob._id }, { progress, stage }).catch(() => {});
    };

    try {
      await ExportJobModel.updateOne(
        { _id: exportJob._id },
        { status: "PROCESSING", startedAt: new Date(), progress: 0, stage: "validating" },
      );
      exportJob.status = "PROCESSING";

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
        onProgress: emit,
      });

      // A cancel that landed mid-render wins: discard the output rather than
      // marking a cancelled job complete.
      const current = await ExportJobModel.findById(exportJobId).select("status").lean();
      if (inFlight.get(exportJobId)?.cancelled || current?.status === "CANCELLED") {
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
        { _id: new Types.ObjectId(projectId) },
        { status: ProjectStatus.EXPORTED },
      ).catch(() => {});

      logger.info("Render completed", { exportJobId, size: result.size });
    } catch (error) {
      const code = error instanceof RenderError ? error.code : "UNKNOWN";
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);

      // Full detail server-side only; the client gets a code it can map to
      // friendly copy.
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
    }
  } finally {
    inFlight.delete(exportJobId);
    releaseSlot();
  }
}

/**
 * Fails jobs left mid-flight by a previous process.
 *
 * Without a queue there is nothing to resume them, so a QUEUED or PROCESSING
 * row at boot is by definition orphaned. Marking it FAILED gives the user a
 * retry button instead of a bar frozen at 40%.
 */
export async function reconcileInterruptedJobs(): Promise<void> {
  const result = await ExportJobModel.updateMany(
    { status: { $in: ["QUEUED", "PROCESSING"] } },
    {
      status: "FAILED",
      errorCode: "WORKER_UNAVAILABLE",
      errorDetail: "The server restarted while this export was rendering.",
      completedAt: new Date(),
    },
  ).catch(() => null);

  if (result?.modifiedCount) {
    logger.warn("Failed exports orphaned by a restart", { count: result.modifiedCount });
  }
}

/** Waits for in-flight renders to settle, up to `timeoutMs`. */
export async function drainRenders(timeoutMs = 10_000): Promise<void> {
  if (inFlight.size === 0) return;
  logger.info("Waiting for in-flight renders", { count: inFlight.size });

  const deadline = Date.now() + timeoutMs;
  while (inFlight.size > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (inFlight.size > 0) {
    logger.warn("Abandoning renders still running at shutdown", { count: inFlight.size });
  }
}
