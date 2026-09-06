import { envs } from "@/common/configs/envs.config";
import type { CookieOptions } from "express";
import jwt, { JsonWebTokenError, JwtPayload } from "jsonwebtoken";
import { SessionUser, UserPayload } from "@/types/user.types";
import { logger } from "../helper/logger";
import argon2 from "argon2";
import { AuthError } from "./error-utils";
import { UserModel } from "@/core/models";

export class AuthUtils {
  private static readonly DEFAULT_COOKIE_DAYS = 7;
  private static readonly domainName =
    envs.NODE_ENV === "development" ? undefined : (process.env.COOKIE_DOMAIN || undefined);
  private static accessTokenSecret = envs.ACCESS_TOKEN_SECRET;
  private static refreshTokenSecret = envs.REFRESH_TOKEN_SECRET;

  static getCookieOptions(days?: number): CookieOptions {
    const isDev = envs.NODE_ENV === "development";

    return {
      httpOnly: true,
      secure: !isDev,
      sameSite: isDev ? "lax" : "none",
      maxAge: (days ?? this.DEFAULT_COOKIE_DAYS) * 86400 * 1000,
      domain: isDev ? undefined : this.domainName,
    };
  }

  static verifyAccessToken(accessToken: string): UserPayload {
    try {
      const decoded = jwt.verify(accessToken, this.accessTokenSecret) as {
        id?: string;
      };

      if (!decoded?.id) {
        throw new JsonWebTokenError("Invalid token payload");
      }

      return { userId: decoded.id };
    } catch {
      throw new JsonWebTokenError("Invalid or expired refresh token");
    }
  }

  static validateEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  static async getHashedPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
    } catch (error) {
      logger.error("Password hashing failed:", error);
      throw new Error("Password hashing failed");
    }
  }

  static async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(hashedPassword, password);
    } catch (error) {
      logger.error("Password verification failed:", error);
      return false;
    }
  }

  static generateTokens(payload: SessionUser): {
    accessToken: string;
    refreshToken: string;
  } {
    const accessToken = jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: "1d",
    });

    const refreshToken = jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: "3d",
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  static async generateAccessTokenFromRefreshToken(
    refreshToken: string,
  ): Promise<string> {
    const decoded = jwt.verify(refreshToken, this.refreshTokenSecret) as {
      id: string;
      role: string;
      tokenVersion?: number;
    };

    if (!decoded || !decoded.id || !decoded.role) {
      throw new JsonWebTokenError(
        "Invalid token payload. Please log in again.",
      );
    }
    const user = await UserModel.findById(decoded.id)
      .select("role tokenVersion")
      .lean();

    if (!user) {
      throw new AuthError(
        "User not found. The token might be invalid or expired.",
      );
    }

    // Reject refresh tokens minted before the last logout / password change.
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new AuthError("Session expired. Please log in again.");
    }

    // Re-issue with the CURRENT role from the DB so a role change takes effect
    // on the next refresh instead of lingering for the token's full lifetime.
    const newAccessToken = jwt.sign(
      { id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion },
      this.accessTokenSecret,
      {
        expiresIn: "1d",
      },
    );

    return newAccessToken;
  }

  static createResetPasswordToken(userId: string): string {
    return jwt.sign({ userId, type: "RESET_PASSWORD" }, envs.RESET_SECRET, {
      expiresIn: "15m",
    });
  }

  static verifyResetPasswordToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, envs.RESET_SECRET) as JwtPayload;

      if (decoded.type !== "RESET_PASSWORD") return null;

      return { userId: decoded.userId };
    } catch {
      return null;
    }
  }
}
