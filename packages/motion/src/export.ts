import { z } from "zod";
import type { ProjectDocument } from "./schema";
import { totalFrames } from "./layer-ops";

/**
 * Export/render domain: the job lifecycle shared by the API, the BullMQ worker
 * and the client's progress UI. Keeping the state machine here means the
 * worker and the dialog agree on what "can I retry this?" means.
 */

export const EXPORT_STATUSES = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"] as const;
export const exportStatusSchema = z.enum(EXPORT_STATUSES);
export type ExportStatus = z.infer<typeof exportStatusSchema>;

export const EXPORT_FORMATS = ["mp4", "webm", "gif"] as const;
export const exportFormatSchema = z.enum(EXPORT_FORMATS);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const EXPORT_QUALITIES = ["draft", "standard", "high", "max"] as const;
export const exportQualitySchema = z.enum(EXPORT_QUALITIES);
export type ExportQuality = z.infer<typeof exportQualitySchema>;

/** CRF and scale per quality tier. Lower CRF is better quality, bigger file. */
export const QUALITY_SETTINGS: Record<ExportQuality, { crf: number; scale: number; label: string; note: string }> = {
  draft: { crf: 32, scale: 0.5, label: "Draft", note: "Fastest · half resolution" },
  standard: { crf: 26, scale: 0.75, label: "Standard", note: "Good balance" },
  high: { crf: 21, scale: 1, label: "High", note: "Recommended · full resolution" },
  max: { crf: 17, scale: 1, label: "Maximum", note: "Largest file · slowest" },
};

export const exportRequestSchema = z.object({
  format: exportFormatSchema.default("mp4"),
  quality: exportQualitySchema.default("high"),
  /** Overrides the project fps when the user picks a different frame rate. */
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(50), z.literal(60)]).optional(),
});
export type ExportRequest = z.infer<typeof exportRequestSchema>;

/** Ordered render phases, surfaced to the user as "Rendering scene 4 of 5". */
export const RENDER_STAGES = ["validating", "preparing", "rendering", "encoding", "uploading", "finalizing"] as const;
export type RenderStage = (typeof RENDER_STAGES)[number];

export const STAGE_LABELS: Record<RenderStage, string> = {
  validating: "Validating project",
  preparing: "Preparing assets",
  rendering: "Rendering frames",
  encoding: "Encoding video",
  uploading: "Uploading result",
  finalizing: "Finishing up",
};

/**
 * Where each stage sits on the 0–100 bar. Rendering dominates because it
 * genuinely does — a progress bar that spends 90% of its life at 10% is worse
 * than no bar at all.
 */
export const STAGE_WEIGHTS: Record<RenderStage, { from: number; to: number }> = {
  validating: { from: 0, to: 4 },
  preparing: { from: 4, to: 12 },
  rendering: { from: 12, to: 78 },
  encoding: { from: 78, to: 90 },
  uploading: { from: 90, to: 98 },
  finalizing: { from: 98, to: 100 },
};

/** Maps stage-local progress (0–1) onto the overall percentage. */
export function overallProgress(stage: RenderStage, stageProgress: number): number {
  const { from, to } = STAGE_WEIGHTS[stage];
  const clamped = stageProgress < 0 ? 0 : stageProgress > 1 ? 1 : stageProgress;
  return Math.round(from + (to - from) * clamped);
}

export interface ExportJobView {
  id: string;
  projectId: string;
  status: ExportStatus;
  progress: number;
  stage?: RenderStage;
  format: ExportFormat;
  quality: ExportQuality;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  outputUrl?: string | null;
  fileSize?: number | null;
  /** User-facing failure reason. Stack traces stay server-side (§31). */
  error?: string | null;
  attempt: number;
  createdAt: string;
  completedAt?: string | null;
}

const TERMINAL: readonly ExportStatus[] = ["COMPLETED", "FAILED", "CANCELLED"];

export function isTerminal(status: ExportStatus): boolean {
  return TERMINAL.includes(status);
}

export function isActive(status: ExportStatus): boolean {
  return status === "QUEUED" || status === "PROCESSING";
}

/** Retry is only meaningful once a job has actually stopped unsuccessfully. */
export function canRetry(status: ExportStatus): boolean {
  return status === "FAILED" || status === "CANCELLED";
}

export function canCancel(status: ExportStatus): boolean {
  return isActive(status);
}

/**
 * The allowed status transitions. The API and worker both check this so a
 * late-arriving progress event can never resurrect a cancelled job.
 */
const TRANSITIONS: Record<ExportStatus, readonly ExportStatus[]> = {
  QUEUED: ["PROCESSING", "CANCELLED", "FAILED"],
  PROCESSING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  // Retry creates a *new* attempt rather than reopening the old row, so the
  // terminal states have no outgoing edges.
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: ExportStatus, to: ExportStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Output dimensions for a request, kept even so H.264 encoders stay happy. */
export function resolveOutputSize(
  doc: Pick<ProjectDocument, "canvas">,
  quality: ExportQuality,
): { width: number; height: number } {
  const scale = QUALITY_SETTINGS[quality].scale;
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(doc.canvas.width), height: even(doc.canvas.height) };
}

/**
 * A rough wall-clock estimate for the export dialog. Deliberately coarse — it
 * exists to set expectations, not to be accurate to the second.
 */
export function estimateRenderSeconds(doc: ProjectDocument, quality: ExportQuality): number {
  const frames = totalFrames(doc);
  const layerFactor = 1 + doc.layers.length * 0.02;
  const qualityFactor = { draft: 0.5, standard: 0.8, high: 1, max: 1.6 }[quality];
  return Math.max(5, Math.round(frames * 0.045 * layerFactor * qualityFactor));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Turns an internal error into something a student can act on. The raw error
 * is logged server-side; this is all the user ever sees (§31).
 */
export function friendlyExportError(code: string | undefined): string {
  switch (code) {
    case "TIMEOUT":
      return "Rendering took longer than the time limit. Try a shorter advertisement or a lower quality setting.";
    case "INVALID_PROJECT":
      return "This project has content the renderer could not read. Reopen it in the editor and try again.";
    case "ASSET_UNAVAILABLE":
      return "One or more media files could not be downloaded. Check that every image and video still uploads correctly.";
    case "STORAGE_FAILED":
      return "The finished video could not be uploaded. Your project is safe — please try exporting again.";
    case "WORKER_UNAVAILABLE":
      return "No rendering worker was available. Your project is saved; please try again in a moment.";
    case "CANCELLED":
      return "This export was cancelled.";
    default:
      return "Something went wrong while rendering. Your project is safe and unchanged.";
  }
}
