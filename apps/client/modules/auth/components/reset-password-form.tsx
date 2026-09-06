"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { Spinner } from "@workspace/ui/components/spinner";

import {
  ResetPasswordDataTypes,
  resetPasswordSchema,
} from "@workspace/schema/auth-schema";

import { useResponseHandler } from "@/hooks/use-response-handler";
import { useTransitionRouter } from "next-view-transitions";
import { useResetPasswordMutation } from "../api/auth-api";

import { BrandLogo } from "@/components/global/brand-logo";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useTransitionRouter();
  const { handleApiResponse } = useResponseHandler();
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const form = useForm<ResetPasswordDataTypes>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onSubmit",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: ResetPasswordDataTypes) {
    await handleApiResponse(
      () =>
        resetPassword({
          token,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }).unwrap(),
      {
        successMessage: "Password reset successful.",
        onSuccess() {
          form.reset();
          setTimeout(() => {
            router.push("/sign-in");
          }, 500);
        },
        onError() {
          form.reset();
          setTimeout(() => {
            router.push("/forgot-password");
          }, 500);
        },
      },
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header with Logo */}
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandLogo className="h-8 mb-5" />
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mb-1.5 tracking-tight">
          Reset Password
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-light">
          Enter a new password for your account.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 dark:text-slate-355 font-medium block mb-1 text-xs">
                  New Password
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder="Enter Password"
                    className="h-11 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-4 focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-500 dark:text-red-400 text-xs" />
              </FormItem>
            )}
          />

          {/* Confirm Password */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 dark:text-slate-355 font-medium block mb-1 text-xs">
                  Confirm Password
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder="Re-enter Password"
                    className="h-11 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-4 focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-500 dark:text-red-400 text-xs" />
              </FormItem>
            )}
          />

          {/* Submit */}
          <Button
            className="
              mt-6 w-full rounded-full h-11
              bg-purple-600 hover:bg-purple-700
              dark:bg-purple-500 dark:hover:bg-purple-600
              text-white font-semibold shadow-md shadow-purple-500/10
              transition-all duration-300 cursor-pointer
            "
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Spinner />
                Updating...
              </div>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
