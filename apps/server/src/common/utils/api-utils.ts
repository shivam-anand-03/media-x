import { Request, Response, NextFunction } from "express";

export class ApiResponse<T = any> {
  public status: "success";
  public message: string;
  public data?: T;

  constructor(message: string, data?: T) {
    this.status = "success";
    this.message = message;
    this.data = data;
  }
}

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
