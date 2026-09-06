import { useUserInfoQuery } from "@/modules/auth/api/auth-api";

export function useUser() {
  const { data: userResponse } = useUserInfoQuery();

  return {
    user: userResponse?.data ?? null,
  };
}
