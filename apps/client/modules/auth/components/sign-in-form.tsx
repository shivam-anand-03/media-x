"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { Link, useTransitionRouter } from "next-view-transitions";
import { LoginDataTypes, loginSchema } from "@workspace/schema/auth-schema";
import { useLoginMutation } from "../api/auth-api";
import { useResponseHandler } from "@/hooks/use-response-handler";
import { Spinner } from "@workspace/ui/components/spinner";
import { useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { useDispatch } from "react-redux";
import ApiServices from "@/data-access/api";

export default function LoginForm() {
  const form = useForm<LoginDataTypes>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const [loginUser, { isLoading }] = useLoginMutation();
  const { handleApiResponse } = useResponseHandler();
  const router = useTransitionRouter();
  const dispatch = useDispatch();
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const onSubmit = async (values: LoginDataTypes) => {
    await handleApiResponse(() => loginUser(values).unwrap(), {
      successMessage: "Logged in successfully.",
      onSuccess: () => {
        form.reset();
        recaptchaRef.current?.reset();
        // Wipe any cached data from a previous session so the new user's role,
        // profile, notifications and dashboard load fresh — never inherited
        // (e.g. a freelancer briefly seeing the previous client's dashboard).
        dispatch(ApiServices.util.resetApiState());
        router.push("/dashboard");
      },
    });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header with Logo */}
      <div className="mb-8 flex flex-col items-center text-center">
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-1.5 tracking-tight">
          Welcome back!
        </h1>
        <p className="text-xs text-muted-foreground font-light">
          Don't have an account?{" "}
          <Link
            href="/sign-up"
            className="text-primary font-semibold hover:underline"
          >
            Sign Up
          </Link>
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground font-medium block mb-1 text-xs">
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="name@company.com"
                    type="email"
                    className="h-11 rounded-full border border-border bg-muted/40 text-foreground placeholder:text-muted-foreground pl-4 focus:ring-2 focus:ring-ring/25 focus:border-primary transition-all"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-destructive text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center mb-1">
                  <FormLabel className="text-foreground font-medium text-xs">
                    Password
                  </FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:text-primary/80 transition-colors hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput
                    placeholder="Enter your password"
                    className="h-11 rounded-full border border-border bg-muted/40 text-foreground placeholder:text-muted-foreground pl-4 focus:ring-2 focus:ring-ring/25 focus:border-primary transition-all"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-destructive text-xs" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className="
              mt-6 w-full rounded-full h-11
              bg-primary hover:bg-primary/90
              text-primary-foreground font-semibold shadow-md shadow-primary/20
              transition-all duration-300 cursor-pointer
            "
          >
            {isLoading ? <Spinner /> : "Sign In"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
