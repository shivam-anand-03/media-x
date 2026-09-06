import { Schema, model, models, type InferSchemaType } from "mongoose";

const logSchema = new Schema(
  {
    level: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    context: {
      type: String,
      trim: true,
    },
    requestId: {
      type: String,
      trim: true,
      index: true,
    },
    method: {
      type: String,
      trim: true,
      index: true,
    },
    path: {
      type: String,
      trim: true,
      index: true,
    },
    statusCode: {
      type: Number,
      index: true,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
    stack: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export type Log = InferSchemaType<typeof logSchema>;

export const LogModel = models.Log || model("Log", logSchema);
