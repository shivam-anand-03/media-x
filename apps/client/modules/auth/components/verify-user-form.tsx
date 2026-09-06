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
      <div className="w-full overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 backdrop-blur-xl shadow-[0_1px_2px_color-mix(in_oklab,var(--foreground)_5%,transparent),0_28px_70px_-30px_color-mix(in_oklab,var(--primary)_35%,transparent)] p-6 md:p-8 transition-colors duration-500">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-extrabold text-foreground mb-2 tracking-tight">
            Please check your email
          </h2>

          <p className="text-xs text-muted-foreground font-light leading-relaxed">
            We've sent a code to{" "}
            <span className="font-semibold text-foreground">
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
            <p className="text-muted-foreground font-light">
              Didn’t receive the code? Resend in{" "}
              <span className="font-semibold text-primary">
                0:{secondsLeft.toString().padStart(2, "0")}
              </span>
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <button
                onClick={handleResend}
                className="text-primary font-bold hover:underline"
              >
                Resend Code
              </button>
              <span className="text-foreground dark:text-foreground">|</span>
              <button
                onClick={() => router.push("/sign-up")}
                className="text-muted-foreground font-medium hover:underline"
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
