import type { Metadata } from "next";
import React from "react";
import AuthCard from "@/modules/auth/components/auth-card";
import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password | Upgence - AI Training Data Marketplace",
  description: "Reset your Upgence account password securely.",
  robots: {
    index: false,
    follow: true,
  },
};

const ForgotPassword = () => {
  return (
    <div className="w-full max-w-5xl px-4 mx-auto">
      <div
        className="
          relative w-full overflow-hidden
          rounded-[2rem]
          border border-slate-200/60 dark:border-slate-800/80
          bg-white/80 dark:bg-slate-950/65
          backdrop-blur-xl
          shadow-2xl shadow-slate-250/30 dark:shadow-black/50
          transition-colors duration-500
          p-1.5
        "
      >
        <AuthCard className="grid lg:grid-cols-2 gap-0">
          {/* LEFT */}
          <div className="flex flex-col justify-center px-4 py-8 sm:px-10 lg:px-12">
            <div className="w-full">
              <ForgotPasswordForm />
            </div>
          </div>
        </AuthCard>
      </div>
    </div>
  );
};

export default ForgotPassword;
