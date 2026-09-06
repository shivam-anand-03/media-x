import type {
  SignUpDataTypes,
  LoginDataTypes,
  OtpVerifyDataTypes,
  ResendOtpDataTypes,
  ForgotPasswordDataTypes,
  ResetPasswordDataTypes,
} from "@workspace/schema/auth-schema";
import type {
  RegisterResponse,
  LoginResponse,
  UserInfoResponse,
} from "./auth-api.types";
import ApiServices from "@/data-access/api";
import { GenericApiResponse } from "@/data-access/types";

// ============================================
// AUTH API ENDPOINTS
// ============================================

const AuthApi = ApiServices.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Register a new user
     * @param userData - SignUpDataTypes with firstName, lastName, email, password, country, userRole
     * @returns RegisterResponse with email
     */
    register: build.mutation<RegisterResponse, SignUpDataTypes>({
      query: (userData) => ({
        url: "/auth/register",
        method: "POST",
        body: userData,
      }),
    }),

    /**
     * Verify OTP code
     * @param data - OtpVerifyDataTypes with email and otp
     * @returns GenericApiResponse
     */
    verifyOtp: build.mutation<GenericApiResponse, OtpVerifyDataTypes>({
      query: (data) => ({
        url: "/auth/verify-otp",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["USERS"],
    }),

    /**
     * Resend OTP to email
     * @param data - ResendOtpDataTypes with email
     * @returns GenericApiResponse
     */
    resendOtp: build.mutation<GenericApiResponse, ResendOtpDataTypes>({
      query: (data) => ({
        url: "/auth/resend/otp",
        method: "POST",
        body: data,
      }),
    }),

    /**
     * Login user with email and password
     * @param credentials - LoginDataTypes with email and password
     * @returns LoginResponse with userId, name, email
     */
    login: build.mutation<LoginResponse, LoginDataTypes>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["USERS"],
    }),

    /**
     * Send password reset link to email
     * @param data - ForgotPasswordDataTypes with email
     * @returns GenericApiResponse
     */
    forgotPassword: build.mutation<GenericApiResponse, ForgotPasswordDataTypes>(
      {
        query: (data) => ({
          url: "/auth/forgot-password",
          method: "PUT",
          body: data,
        }),
      },
    ),

    /**
     * Reset password with token and new password
     * @param data - ResetPasswordDataTypes with password, confirmPassword, and token
     * @returns GenericApiResponse
     */
    resetPassword: build.mutation<GenericApiResponse, ResetPasswordDataTypes>({
      query: (data) => ({
        url: "/auth/reset-password",
        method: "PUT",
        body: data,
      }),
    }),

    /**
     * Refresh access token using refresh token
     * @returns GenericApiResponse
     */
    refreshToken: build.mutation<GenericApiResponse, void>({
      query: () => ({
        url: "/auth/refresh/token",
        method: "POST",
      }),
    }),

    /**
     * Get current authenticated user information
     * @returns UserInfoResponse with user profile
     */
    userInfo: build.query<UserInfoResponse, void>({
      query: () => ({
        url: "/auth/user",
        method: "GET",
      }),
      providesTags: ["USERS"],
    }),

    /**
     * Logout user and clear authentication
     * @returns GenericApiResponse
     */
    logout: build.mutation<GenericApiResponse, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
    }),
  }),
});

// ============================================
// EXPORT HOOKS
// ============================================

export const {
  // Mutations
  useRegisterMutation,
  useVerifyOtpMutation,
  useResendOtpMutation,
  useLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  // Queries
  useUserInfoQuery,
} = AuthApi;

export default AuthApi;
