import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

export const AsyncHandler = (
  asyncFunction: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void>,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await asyncFunction(req, res, next);
    } catch (err) {
      next(err);
    }
  };
};

export const createJobId = (prefix: string) => `${prefix}_${randomUUID()}`;

export const makeUniqueName = (name: string): string => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const timestamp = Date.now().toString(36); // time-based uniqueness
  const random = crypto.randomUUID().split("-")[0]; // strong randomness

  return `${base}@${timestamp}-${random}`;
};
