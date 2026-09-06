import { Schema, model, models, Model, Document, Types } from "mongoose";

export interface IProfile {
  userId: Types.ObjectId | string;
  bio?: string | null;
  phone?: string | null;
  avatar?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  isProfileComplete?: boolean;
}

export interface IProfileDocument extends IProfile, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<IProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    bio: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    avatar: {
      type: String,
      default: null,
    },
    website: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },
    city: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      default: null,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        return ret;
      },
    },
  },
);

export const ProfileModel: Model<IProfileDocument> =
  (models.Profile as Model<IProfileDocument>) ||
  model<IProfileDocument>("Profile", profileSchema);
