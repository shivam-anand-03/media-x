import axios from "axios";
import jwt from "jsonwebtoken";
import { CookieOptions, Request, Response } from "express";
import {
  AppError,
  NotFoundError,
  ValidationError,
  AuthError,
} from "@/common/utils/error-utils";
import { envs } from "@/common/configs/envs.config";
import { cache } from "@/common/configs/redis.config";
import { logger } from "@/common/helper/logger";
import {
  signUpSchema,
  loginSchema,
  otpVerifySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendOtpSchema,
} from "@workspace/schema/auth-schema";
import { queueManager } from "@/common/queue/queue-manager";
import { EmailQueue } from "@/common/queue/email.queue";
import { AuthUtils } from "@/common/utils/auth-utils";
import { getAuth } from "@/common/helper/global";
import { ApiResponse, AsyncHandler } from "@/common/utils/api-utils";
import { UserModel, ProfileModel, Role, AuthProvider } from "@/core/models";

class AuthController {
  constructor(
    private readonly emailQueue = queueManager.get<EmailQueue>("email-queue"),
  ) {}

  registerUserHandler = AsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { firstName, lastName, email, password, country, userRole, role } =
        signUpSchema.parse(req.body);

      if (!firstName || !email || !password) {
        throw new ValidationError("All fields are required.");
      }

      if (!AuthUtils.validateEmail(email)) {
        throw new ValidationError("Email is invalid.");
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await UserModel.findOne({ email: normalizedEmail });

      if (existingUser) {
        throw new ValidationError(
          "User already exists. Please log in instead.",
        );
      }

      const hashedPassword = await AuthUtils.getHashedPassword(password);

      try {
        const assignedRole = (role || userRole || "USER") as Role;

        const user = await UserModel.create({
          firstName,
          lastName,
          email: normalizedEmail,
          password: hashedPassword,
          role: Object.values(Role).includes(assignedRole)
            ? assignedRole
            : Role.USER,
          country,
        });

        await ProfileModel.create({
          userId: user._id,
        });

        await this.emailQueue.sendOtp(normalizedEmail, `${firstName} ${lastName}`);

        res.status(200).json(
          new ApiResponse("Registration successful!", {
            email: user.email,
          }),
        );
      } catch (err: any) {
        if (err.code === 11000) {
          throw new ValidationError("Email is already registered.");
        }
        if (err instanceof ValidationError) throw err;
        throw new AppError("Registration failed. Please try again later.", 500);
      }
    },
  );

  resendOtpHandler = AsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email } = resendOtpSchema.parse(req.body);
      const normalizedEmail = email.toLowerCase().trim();

      const user = await UserModel.findOne({ email: normalizedEmail });

      if (!user) {
        throw new NotFoundError("User not found");
      }

      await this.emailQueue.sendOtp(
        normalizedEmail,
        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "User",
      );

      res.status(200).json(new ApiResponse("OTP has been sent to your email."));
    },
  );

  verifyOtpHandler = AsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, otp } = otpVerifySchema.parse(req.body);

      if (!email) {
        throw new ValidationError("Email is required.");
      }
      const normalizedEmail = email.toLowerCase().trim();

      const user = await UserModel.findOne({ email: normalizedEmail });
      if (!user) {
        throw new NotFoundError("No user found with this email.");
      }

      const savedOtp = await cache.get(`otp:${normalizedEmail}`);

      if (!savedOtp) {
        throw new NotFoundError(
          "OTP expired or not found. Please request a new one.",
        );
      }

      const isDev = envs.NODE_ENV === "development";
      if (savedOtp !== otp && !(isDev && otp === "123456")) {
        throw new ValidationError("Invalid OTP entered. Please try again.");
      }

      await cache.del(`otp:${normalizedEmail}`);

      await UserModel.updateOne(
        { email: normalizedEmail },
        { $set: { isVerified: true, isEmailVerified: true } },
      );

      res.status(200).json(new ApiResponse("OTP verified successfully."));
    },
  );

  loginUserHandler = AsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, password } = loginSchema.parse(req.body);
      const normalizedEmail = email.toLowerCase().trim();

      const user = await UserModel.findOne({ email: normalizedEmail });

      if (!user || !user.password) {
        throw new ValidationError("Invalid email or password.");
      }

      const isPasswordValid = await AuthUtils.verifyPassword(
        password,
        user.password,
      );

      if (!isPasswordValid) {
        throw new ValidationError("Invalid email or password.");
      }

      const userId = user.id || user._id.toString();

      const { accessToken, refreshToken } = AuthUtils.generateTokens({
        id: userId,
        role: user.role || Role.USER,
        tokenVersion: user.tokenVersion,
      });

      res.cookie("access_token", accessToken, AuthUtils.getCookieOptions(1));
      res.cookie("refresh_token", refreshToken, AuthUtils.getCookieOptions(7));

      res.status(200).json(
        new ApiResponse("Logged in successfully.", {
          userId,
          name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        }),
      );
    },
  );

  forgotPasswordHandler = AsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email } = forgotPasswordSchema.parse(req.body);
      const normalizedEmail = email.toLowerCase().trim();

      const user = await UserModel.findOne({ email: normalizedEmail });

      if (!user) {
        throw new ValidationError("User with this email not found.");
      }

      const userId = user.id || user._id.toString();

      await this.emailQueue.sendResetPasswordEmail(
        user.email,
        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "User",
        userId,
      );

      res
        .status(200)
        .json(new ApiResponse("Password reset link has been sent to your email."));
    },
  );

  resetPasswordHandler = AsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { password, token } = resetPasswordSchema.parse(req.body);

      const resetTokenData = AuthUtils.verifyResetPasswordToken(
        token as string,
      );

      if (!resetTokenData) {
        throw new AppError("Invalid or expired reset link", 400);
      }

      const { userId } = resetTokenData;

      const user = await UserModel.findById(userId).select("_id");

      if (!user) {
        throw new AppError("Invalid or expired reset link", 400);
      }

      const hashedPassword = await AuthUtils.getHashedPassword(password);

      await UserModel.findByIdAndUpdate(userId, {
        $set: { password: hashedPassword },
        $inc: { tokenVersion: 1 },
      });

      res.status(200).json(new ApiResponse("Password reset successful"));
    },
  );

  refreshTokenHandler = AsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const refreshToken = req.cookies?.refresh_token;

      if (!refreshToken) {
        throw new AuthError("Refresh token missing. Please login again.");
      }

      const accessToken =
        await AuthUtils.generateAccessTokenFromRefreshToken(refreshToken);
      res.cookie("access_token", accessToken, AuthUtils.getCookieOptions(1));

      res
        .status(200)
        .json(new ApiResponse("Access token refreshed successfully"));
    },
  );



  logOutHandler = AsyncHandler(async (req: Request, res: Response) => {
    const isDev = envs.NODE_ENV === "development";
    const idFrom = (token?: string, secret?: string): string | undefined => {
      if (!token || !secret) return undefined;
      try {
        const payload = jwt.verify(token, secret, {
          ignoreExpiration: true,
        }) as { id?: string };
        return payload?.id;
      } catch {
        return undefined;
      }
    };

    const userId =
      req.user?.id ??
      idFrom(req.cookies?.access_token, envs.ACCESS_TOKEN_SECRET) ??
      idFrom(req.cookies?.refresh_token, envs.REFRESH_TOKEN_SECRET);

    if (userId) {
      try {
        await UserModel.findByIdAndUpdate(userId, {
          $inc: { tokenVersion: 1 },
        });
      } catch (err) {
        logger.warn("Logout: tokenVersion bump skipped", { err });
      }
    }

    const clearOptions: CookieOptions = {
      httpOnly: true,
      secure: !isDev,
      sameSite: isDev ? "lax" : "none",
      path: "/",
      domain: isDev ? undefined : (process.env.COOKIE_DOMAIN || undefined),
    };

    res.clearCookie("access_token", clearOptions);
    res.clearCookie("refresh_token", clearOptions);

    res.status(200).json(new ApiResponse("Logged out successfully"));
  });

  userInfoHandler = AsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { userId } = await getAuth(req);

      const cacheKey = `user:${userId}:info`;

      let userInfo;
      const cachedUser = await cache.get(cacheKey);
      if (cachedUser) {
        userInfo = JSON.parse(cachedUser);
      } else {
        const dbUser = await UserModel.findById(userId)
          .select(
            "firstName lastName email role avatar country phoneNumber isVerified isEmailVerified",
          )
          .lean();

        if (!dbUser) {
          throw new NotFoundError("User not found.");
        }

        userInfo = {
          id: dbUser._id.toString(),
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          email: dbUser.email,
          role: dbUser.role,
          avatar: dbUser.avatar,
          country: dbUser.country,
          phoneNumber: dbUser.phoneNumber,
          isVerified: dbUser.isVerified,
          isEmailVerified: dbUser.isEmailVerified,
        };

        await cache.setex(cacheKey, 3600, JSON.stringify(userInfo));
      }

      res.status(200).json(new ApiResponse("User info fetched", userInfo));
    },
  );
}

export default new AuthController();
