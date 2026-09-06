"use client";

import { InputOTPForm } from "./input-otp-form";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useResendOtpMutation } from "../api/auth-api";
import { useResponseHandler } from "@/hooks/use-response-handler";
import { useTransitionRouter } from "next-view-transitions";

export default function VerifyUserForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const { handleApiResponse } = useResponseHandler();
  const [resendOtp] = useResendOtpMutation();
  const router = useTransitionRouter();
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const expireAt = Number(localStorage.getItem("app_otp_expire_at"));
    if (expireAt && expireAt > Date.now()) {
      setSecondsLeft(Math.floor((expireAt - Date.now()) / 1000));
    }
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  async function handleResend() {
    await handleApiResponse(() => resendOtp({ email }).unwrap(), {
      onSuccess() {
        const expireAt = Date.now() + 60 * 1000;
        localStorage.setItem("app_otp_expire_at", expireAt.toString());
        setSecondsLeft(60);
      },
    });
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 flex flex-col items-center">
      <div className="w-full overflow-hidden rounded-[2rem] border border-slate-200/60 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/65 backdrop-blur-xl shadow-2xl shadow-slate-250/30 dark:shadow-black/50 p-6 md:p-8 transition-colors duration-500">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
            Please check your email
          </h2>

          <p className="text-xs text-slate-500 dark:text-slate-400 font-light leading-relaxed">
            We've sent a code to{" "}
            <span className="font-semibold text-slate-750 dark:text-slate-300">
              {email}
            </span>{" "}
            to verify your account
          </p>
        </div>

        {/* OTP INPUT */}
        <InputOTPForm onResend={handleResend} />

        {/* Resend Timer & Actions */}
        <div className="mt-6 flex flex-col items-center justify-center gap-2 text-xs">
          {secondsLeft > 0 ? (
            <p className="text-slate-500 dark:text-slate-400 font-light">
              Didn’t receive the code? Resend in{" "}
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                0:{secondsLeft.toString().padStart(2, "0")}
              </span>
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <button
                onClick={handleResend}
                className="text-purple-600 dark:text-purple-400 font-bold hover:underline"
              >
                Resend Code
              </button>
              <span className="text-slate-200 dark:text-slate-800">|</span>
              <button
                onClick={() => router.push("/sign-up")}
                className="text-slate-500 dark:text-slate-400 font-medium hover:underline"
              >
                Edit Email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
