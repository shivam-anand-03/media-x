import { AppError } from "@/common/utils/error-utils";
import { logger } from "@/common/helper/logger";
import { ErrorRequestHandler } from "express";

function resolveStatus(err: any): number {
  if (err instanceof AppError) return err.statusCode;
  if (err?.code === "P2002") return 400;
  if (err?.code === "P2025") return 404;
  if (err?.name === "ZodError") return 400;
  return 500;
}

export const errorMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  const statusCode = resolveStatus(err);
  const level = statusCode >= 500 ? "error" : "warn";

  logger[level](
    err instanceof AppError ? err.message : err?.message || "Unhandled error",
    {
      context: "http",
      method: req.method,
      path: req.originalUrl,
      statusCode,
      userId: (req as any).user?.id,
      ...(level === "error" && err?.stack ? { stack: err.stack } : {}),
    },
  );

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.isOperational ? "failed" : "error",
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  if ((err as any).code === "P2002") {
    return res.status(400).json({
      status: "failed",
      message: "Duplicate value , this field must be unique.",
    });
  }

  if ((err as any).code === "P2025") {
    return res.status(404).json({
      status: "failed",
      message: "Record not found.",
    });
  }

  if ((err as any).name === "ZodError") {
    return res.status(400).json({
      status: "failed",
      message: "Validation error",
      details: err.errors,
    });
  }
  return res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
};
