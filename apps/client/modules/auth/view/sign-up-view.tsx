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
          border border-border/70
          bg-card/80
          backdrop-blur-xl
          shadow-[0_1px_2px_color-mix(in_oklab,var(--foreground)_5%,transparent),0_28px_70px_-30px_color-mix(in_oklab,var(--primary)_35%,transparent)]
          transition-colors duration-500
          p-1.5
        "
      >
        <AuthCard className="grid lg:grid-cols-2 gap-0">
          {/* LEFT */}
          <div className="flex flex-col justify-center px-4 py-8 sm:px-10 lg:px-12">
            {/* Logo and Heading */}
            <div className="mb-6 flex flex-col items-center text-center max-w-md mx-auto">
              <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight leading-snug">
                Sign up to find work you love
              </h1>
              <p className="mt-1.5 text-xs text-muted-foreground font-light">
                Already have an account?{" "}
                <Link
                  href="/sign-in"
                  className="font-semibold text-primary hover:underline transition-colors"
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
