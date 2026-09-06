import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const otpVerifySchema = z.object({
  email: z.string().email("Enter a valid email").optional(),
  otp: z.string().min(1, "OTP is required"),
});

export const signUpSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
  country: z.string().optional(),
  sendEmails: z.boolean().optional(),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms and conditions",
  }),
  role: z.enum(["USER", "ADMIN"]).optional(),
  userRole: z.string().optional(),
});

export const sessionSchema = z.object({
  adminId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  metaData: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Minimum 8 characters"),
    confirmPassword: z.string(),
    token: z.string().min(1, "Invalid or expired reset link").optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const joiningSchema = z.object({
  userRole: z.enum(["USER", "ADMIN", "CLIENT", "FREELANCER"]).optional(),
});

export const resendOtpSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export type ResetPasswordDataTypes = z.infer<typeof resetPasswordSchema>;
export type SessionTypes = z.infer<typeof sessionSchema>;
export type LoginDataTypes = z.infer<typeof loginSchema>;
export type ForgotPasswordDataTypes = z.infer<typeof forgotPasswordSchema>;
export type OtpVerifyDataTypes = z.infer<typeof otpVerifySchema>;
export type SignUpDataTypes = z.infer<typeof signUpSchema>;
export type JoiningDataTypes = z.infer<typeof joiningSchema>;
export type ResendOtpDataTypes = z.infer<typeof resendOtpSchema>;
