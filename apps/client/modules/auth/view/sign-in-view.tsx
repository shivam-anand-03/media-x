import AuthCard from "../components/auth-card";
import LoginForm from "../components/sign-in-form";

export function SignInView() {
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
            <div className="w-full">
              <LoginForm />
            </div>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
