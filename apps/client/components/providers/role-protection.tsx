"use client";

import { useAuthRoleStore } from "@/stores/user-store";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function RoleProtection({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { userRole } = useAuthRoleStore();

  useEffect(() => {
    // Check if we have tokens (meaning user is authenticated)
    const hasTokens =
      typeof window !== "undefined" &&
      (document.cookie.includes("access_token") ||
        document.cookie.includes("refresh_token"));

    // If authenticated but no role, redirect to "/" to select role
    if (hasTokens && !userRole && pathname !== "/") {
      router.push("/");
    }
  }, [userRole, pathname, router]);

  // Return children immediately to avoid blank page flash
  // Role check happens in background
  return <>{children}</>;
}
