import { ApiResponse, GenericApiResponse } from "@/data-access/types";

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * User registration response
 */
export type RegisterResponse = ApiResponse<{
  email: string;
}>;

/**
 * User login response
 */
export type LoginResponse = ApiResponse<{
  userId: string;
  name: string;
  email: string;
}>;

/**
 * User information response
 */
export type UserInfoResponse = ApiResponse<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role:
    | "CLIENT"
    | "FREELANCER"
    | "ADMIN"
    | "CLIENT_COWORKER"
    | "COORDINATOR"
    | "PROJECT_MANAGER";
  avatar?: string;
}>;

// ============================================
// USER DATA TYPES
// ============================================

/**
 * User profile data
 */
export type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role:
    | "CLIENT"
    | "FREELANCER"
    | "ADMIN"
    | "CLIENT_COWORKER"
    | "COORDINATOR"
    | "PROJECT_MANAGER";
  avatar?: string;
};

// ============================================
// REQUEST/RESPONSE TYPE MAPPINGS
// ============================================

export type AuthApiResponses = {
  register: RegisterResponse;
  verifyOtp: GenericApiResponse;
  resendOtp: GenericApiResponse;
  login: LoginResponse;
  forgotPassword: GenericApiResponse;
  resetPassword: GenericApiResponse;
  refreshToken: GenericApiResponse;
  logout: GenericApiResponse;
  userInfo: UserInfoResponse;
};
