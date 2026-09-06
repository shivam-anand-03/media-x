import { envs } from "@/common/configs/envs.config";
import { AuthError, TokenError } from "@/common/utils/error-utils";
import { SessionUser } from "@/types/user.types";
import { Role, UserModel } from "@/core/models";
import { NextFunction, Request, Response } from "express";
import jwt, { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token =
      req.cookies.access_token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      throw new AuthError("Access denied. No access token provided.", {
        error: "TOKEN_MISSING",
      });
    }

    const decoded = jwt.verify(
      token,
      envs.ACCESS_TOKEN_SECRET!,
    ) as SessionUser & { exp: number };

    if (!decoded?.id || !decoded?.role) {
      throw new AuthError("Invalid token payload.", {
        error: "TOKEN_PAYLOAD_INVALID",
      });
    }

    // Check if the user exists and if the token version matches the one in the database.
    const user = await UserModel.findById(decoded.id)
      .select("role tokenVersion")
      .lean();

    if (!user) {
      throw new AuthError("User no longer exists.", {
        error: "USER_NOT_FOUND",
      });
    }

    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new AuthError("Session expired. Please log in again.", {
        error: "TOKEN_REVOKED",
      });
    }

    req.user = { id: user._id.toString(), role: user.role || Role.USER };

    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return next(
        new TokenError("Access token expired. Please refresh token.", {
          error: "TOKEN_EXPIRED",
        }),
      );
    }

    if (error instanceof JsonWebTokenError) {
      return next(
        new AuthError("Invalid access token.", { error: "TOKEN_INVALID" }),
      );
    }

    // AuthError from the guards above (missing token, revoked, etc.) and any
    // unexpected error flow to the central error middleware.
    return next(error);
  }
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        throw new AuthError("Access denied. Authentication required.");
      }

      if (!allowedRoles.includes(user.role as Role)) {
        throw new AuthError(
          `Access denied. Access restricted to roles: ${allowedRoles.join(", ")}`,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
