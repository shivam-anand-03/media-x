import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import { AuthError } from "../utils/error-utils";
import { UserModel } from "@/core/models";

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

export const getAuth = async (req: Request) => {
  if (!req.user || !req.user.id) {
    throw new AuthError("Unauthorized access. User info not found.");
  }

  const userId = req.user.id;

  const user = await UserModel.findById(userId);

  if (!user) {
    throw new AuthError("User not found in the database.");
  }

  return {
    userId: user.id || user._id.toString(),
    role: user.role,
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
