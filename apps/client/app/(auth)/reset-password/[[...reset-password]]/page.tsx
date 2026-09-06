"use client";

import { useSearchParams } from "next/navigation";
import { ResetPasswordView } from "@/modules/auth/view/reset-password-view";

const ResetPassword = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  return <ResetPasswordView token={token} />;
};

export default ResetPassword;
