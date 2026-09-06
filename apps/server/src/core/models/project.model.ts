import { Schema, model, models, Model, Document, Types } from "mongoose";
import type { ProjectDocument as MotionProjectDocument } from "@workspace/motion";

/**
 * An advertisement project.
 *
 * The canvas document itself is stored as one opaque subdocument
 * (`projectData`) rather than normalised into layer/transform collections.
 * That is deliberate: the editor always reads and writes the whole document,
 * the schema evolves per release, and joining a hundred layer rows back
 * together on every autosave would be pure overhead. Mongo's document model is
 * the equivalent of the JSONB column §34 asks for.
 */

export const ProjectStatus = {
  DRAFT: "DRAFT",
  READY: "READY",
  EXPORTED: "EXPORTED",
  ARCHIVED: "ARCHIVED",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export interface IProject {
  name: string;
  description?: string | null;
  width: number;
  height: number;
  fps: number;
  duration: number;
  /** The canonical document — validated against `projectDocumentSchema`. */
  projectData: MotionProjectDocument;
  status: ProjectStatus;
  /** Data URL or object-storage URL of the last generated poster frame. */
  thumbnail?: string | null;
  templateSlug?: string | null;
  lastOpenedAt?: Date | null;
  /**
   * Bumped on every persisted mutation. The client sends the version it based
   * its edit on so a stale tab cannot silently clobber a newer save.
   */
  revision: number;
}

export interface IProjectDocument extends IProject, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProjectDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: null, maxlength: 500 },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    fps: { type: Number, required: true, default: 30 },
    duration: { type: Number, required: true, default: 10 },
    // `Mixed` because the shape is owned by the zod schema in @workspace/motion,
    // not by Mongoose. Validation happens at the API boundary.
    projectData: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.DRAFT,
      index: true,
    },
    thumbnail: { type: String, default: null },
    templateSlug: { type: String, default: null },
    lastOpenedAt: { type: Date, default: null },
    revision: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// The dashboard's default view: this user's projects, most recently touched
// first. Compound so the sort is served by the index rather than in memory.
projectSchema.index({ updatedAt: -1 });
projectSchema.index({ status: 1, updatedAt: -1 });

export const ProjectModel: Model<IProjectDocument> =
  (models.Project as Model<IProjectDocument>) || model<IProjectDocument>("Project", projectSchema);
