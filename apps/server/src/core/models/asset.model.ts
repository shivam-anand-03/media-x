import { Schema, model, models, Model, Document, Types } from "mongoose";

/**
 * A media file owned by a user. Binary content never lives here — only a
 * pointer into object storage plus the metadata the editor needs to place the
 * asset without downloading it first (§35).
 */

export const AssetType = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
  LOGO: "LOGO",
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

export const AssetStatus = {
  PENDING: "PENDING",
  READY: "READY",
  FAILED: "FAILED",
} as const;
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

export interface IAsset {
  /** Null for library assets that are not scoped to a single project. */
  projectId?: Types.ObjectId | null;
  type: AssetType;
  status: AssetStatus;
  filename: string;
  mimeType: string;
  size: number;
  /** Storage key; the public/signed URL is derived from it at read time. */
  storagePath: string;
  url: string;
  thumbnailUrl?: string | null;
  metadata: {
    width?: number;
    height?: number;
    /** Seconds — set for audio and video. */
    duration?: number;
  };
  error?: string | null;
}

export interface IAssetDocument extends IAsset, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IAssetDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    type: { type: String, enum: Object.values(AssetType), required: true },
    status: { type: String, enum: Object.values(AssetStatus), default: AssetStatus.PENDING },
    filename: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    metadata: {
      width: { type: Number },
      height: { type: Number },
      duration: { type: Number },
    },
    error: { type: String, default: null },
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

assetSchema.index({ createdAt: -1 });
assetSchema.index({ type: 1, createdAt: -1 });

export const AssetModel: Model<IAssetDocument> =
  (models.Asset as Model<IAssetDocument>) || model<IAssetDocument>("Asset", assetSchema);
