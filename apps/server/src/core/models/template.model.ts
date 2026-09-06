import { Schema, model, models, Model, Document } from "mongoose";
import type { ProjectDocument as MotionProjectDocument } from "@workspace/motion";

/**
 * A starter advertisement. `projectData` is a complete project document, so
 * "use template" is a straight copy into a new project — there is no separate
 * template format that could drift from what the editor understands.
 */
export interface ITemplate {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  featured: boolean;
  thumbnail?: string | null;
  /** Two hex colours used to paint the browser card without a bitmap. */
  accent: string[];
  width: number;
  height: number;
  duration: number;
  sceneCount: number;
  layerCount: number;
  projectData: MotionProjectDocument;
  usageCount: number;
}

export interface ITemplateDocument extends ITemplate, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<ITemplateDocument>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, required: true, index: true },
    tags: { type: [String], default: [] },
    featured: { type: Boolean, default: false, index: true },
    thumbnail: { type: String, default: null },
    accent: { type: [String], default: [] },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    duration: { type: Number, required: true },
    sceneCount: { type: Number, default: 0 },
    layerCount: { type: Number, default: 0 },
    projectData: { type: Schema.Types.Mixed, required: true },
    usageCount: { type: Number, default: 0 },
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
  },
);

templateSchema.index({ category: 1, featured: -1 });

export const TemplateModel: Model<ITemplateDocument> =
  (models.Template as Model<ITemplateDocument>) || model<ITemplateDocument>("Template", templateSchema);
