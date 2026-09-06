import { logger } from "@/common/helper/logger";
import { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    logger.info(
      `[${req.method}] ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms | IP: ${req.ip}`,
      {
        persist: false,
      },
    );
  });

  next();
}
