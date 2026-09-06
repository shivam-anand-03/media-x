import AuthCard from "../components/auth-card";
import { ResetPasswordForm } from "../components/reset-password-form";

export function ResetPasswordView({ token }: { token: string }) {
  if (!token)
    return (
      <div className="text-slate-900 dark:text-white text-center py-12 font-semibold">
        Invalid or missing token.
      </div>
    );

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
              <ResetPasswordForm token={token} />
            </div>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
