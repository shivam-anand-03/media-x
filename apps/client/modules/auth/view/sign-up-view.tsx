import Link from "next/link";
import { SignUpForm } from "../components/sign-up-form";
import AuthCard from "../components/auth-card";

export function SignUpView() {
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
            {/* Logo and Heading */}
            <div className="mb-6 flex flex-col items-center text-center max-w-md mx-auto">
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
                Sign up to find work you love
              </h1>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-light">
                Already have an account?{" "}
                <Link
                  href="/sign-in"
                  className="font-semibold text-purple-600 dark:text-purple-400 hover:underline transition-colors"
                >
                  Log in
                </Link>
              </p>
            </div>

            {/* Form */}
            <div className="w-full max-w-md mx-auto">
              <SignUpForm />
            </div>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
