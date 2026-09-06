import { Router } from "express";
import { requireAuth } from "@/core/middleware/auth.middleware";
import authController from "./auth.controller";

const authRouter: Router = Router();

authRouter.post("/register", authController.registerUserHandler);
authRouter.post("/verify-otp", authController.verifyOtpHandler);
authRouter.post("/login", authController.loginUserHandler);
authRouter.post("/resend/otp", authController.resendOtpHandler);
authRouter.post("/refresh/token", authController.refreshTokenHandler);
authRouter.put("/forgot-password", authController.forgotPasswordHandler);
authRouter.put("/reset-password", authController.resetPasswordHandler);
authRouter.post("/logout", authController.logOutHandler);

authRouter.use(requireAuth);
authRouter.get("/user", authController.userInfoHandler);

export default authRouter;
