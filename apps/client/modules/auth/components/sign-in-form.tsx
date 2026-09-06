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
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mb-1.5 tracking-tight">
          Welcome back!
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-light">
          Don't have an account?{" "}
          <Link
            href="/sign-up"
            className="text-purple-600 dark:text-purple-400 font-semibold hover:underline"
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
                <FormLabel className="text-slate-700 dark:text-slate-350 font-medium block mb-1 text-xs">
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="name@company.com"
                    type="email"
                    className="h-11 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-4 focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-500 dark:text-red-400 text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center mb-1">
                  <FormLabel className="text-slate-700 dark:text-slate-350 font-medium text-xs">
                    Password
                  </FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput
                    placeholder="Enter your password"
                    className="h-11 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-4 focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-500 dark:text-red-400 text-xs" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className="
              mt-6 w-full rounded-full h-11
              bg-purple-600 hover:bg-purple-700
              dark:bg-purple-500 dark:hover:bg-purple-600
              text-white font-semibold shadow-md shadow-purple-500/10
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
