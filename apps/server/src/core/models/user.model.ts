import { Schema, model, models, Model, Document } from "mongoose";

export const Role = {
  USER: "USER",
  ADMIN: "ADMIN",
  MODERATOR: "MODERATOR",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const AuthProvider = {
  LOCAL_AUTH: "LOCAL_AUTH",
} as const;

export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export interface IUser {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  password?: string | null;
  tokenVersion: number;
  country?: string | null;
  phoneNumber?: string | null;
  avatar?: string | null;
  isVerified: boolean;
  isEmailVerified: boolean;
  role: Role;
  provider: AuthProvider;
}

export interface IUserDocument extends IUser, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUserDocument>(
  {
    firstName: {
      type: String,
      trim: true,
      default: null,
    },
    lastName: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      index: true,
    },
    country: {
      type: String,
      trim: true,
      default: null,
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: null,
    },
    avatar: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.USER,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(AuthProvider),
      default: AuthProvider.LOCAL_AUTH,
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

userSchema.index({ role: 1, _id: 1 });

export const UserModel: Model<IUserDocument> =
  (models.User as Model<IUserDocument>) ||
  model<IUserDocument>("User", userSchema);
