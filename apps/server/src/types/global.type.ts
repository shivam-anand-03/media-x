import { Request } from "express";
import { SessionUser } from "./user.types";

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export {};
