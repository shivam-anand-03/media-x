import { Schema, model, models, Model, Document, Types } from "mongoose";
import type {
  ExportFormat,
  ExportQuality,
  ExportStatus,
  RenderStage,
} from "@workspace/motion";

/**
 * One rendering attempt.
 *
 * A retry creates a *new* job rather than reopening this one (see
 * `canTransition` in @workspace/motion): keeping every attempt as its own row
 * means the history of a flaky render is preserved and the state machine has
 * no cycles to reason about.
 */
export interface IExportJob {
  userId: Types.ObjectId;
  projectId: Types.ObjectId;
  status: ExportStatus;
  progress: number;
  stage?: RenderStage | null;
  format: ExportFormat;
  quality: ExportQuality;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  /**
   * The exact document that was rendered. Snapshotting it means a completed
   * export always describes the video that actually exists, even after the
   * user keeps editing the project.
   */
  projectSnapshot: unknown;
  outputUrl?: string | null;
  storagePath?: string | null;
  fileSize?: number | null;
  /** Machine-readable failure cause; mapped to friendly copy on the client. */
  errorCode?: string | null;
  /** Full internal detail — never returned to a non-owner, never surfaced raw. */
  errorDetail?: string | null;
  attempt: number;
  /** Links attempts of the same export lineage together. */
  rootJobId?: Types.ObjectId | null;
  queueJobId?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface IExportJobDocument extends IExportJob, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

const exportJobSchema = new Schema<IExportJobDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    status: {
      type: String,
      enum: ["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"],
      default: "QUEUED",
      index: true,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    stage: { type: String, default: null },
    format: { type: String, enum: ["mp4", "webm", "gif"], default: "mp4" },
    quality: { type: String, enum: ["draft", "standard", "high", "max"], default: "high" },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    fps: { type: Number, required: true },
    durationSeconds: { type: Number, required: true },
    projectSnapshot: { type: Schema.Types.Mixed, required: true },
    outputUrl: { type: String, default: null },
    storagePath: { type: String, default: null },
    fileSize: { type: Number, default: null },
    errorCode: { type: String, default: null },
    errorDetail: { type: String, default: null },
    attempt: { type: Number, default: 1 },
    rootJobId: { type: Schema.Types.ObjectId, ref: "ExportJob", default: null },
    queueJobId: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        // The snapshot can be hundreds of KB and the client already has the
        // document; never ship it back on a status poll.
        delete ret.projectSnapshot;
        delete ret.errorDetail;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

exportJobSchema.index({ projectId: 1, createdAt: -1 });
exportJobSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const ExportJobModel: Model<IExportJobDocument> =
  (models.ExportJob as Model<IExportJobDocument>) ||
  model<IExportJobDocument>("ExportJob", exportJobSchema);
