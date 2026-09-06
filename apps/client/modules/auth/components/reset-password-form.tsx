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
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-1.5 tracking-tight">
          Reset Password
        </h1>
        <p className="text-xs text-muted-foreground font-light">
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
                <FormLabel className="text-foreground dark:text-muted-foreground font-medium block mb-1 text-xs">
                  New Password
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder="Enter Password"
                    className="h-11 rounded-full border border-border bg-muted/40 text-foreground placeholder:text-muted-foreground pl-4 focus:ring-2 focus:ring-ring/25 focus:border-primary transition-all"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-destructive text-xs" />
              </FormItem>
            )}
          />

          {/* Confirm Password */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground dark:text-muted-foreground font-medium block mb-1 text-xs">
                  Confirm Password
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder="Re-enter Password"
                    className="h-11 rounded-full border border-border bg-muted/40 text-foreground placeholder:text-muted-foreground pl-4 focus:ring-2 focus:ring-ring/25 focus:border-primary transition-all"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-destructive text-xs" />
              </FormItem>
            )}
          />

          {/* Submit */}
          <Button
            className="
              mt-6 w-full rounded-full h-11
              bg-primary hover:bg-primary/90
              text-primary-foreground font-semibold shadow-md shadow-primary/20
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
