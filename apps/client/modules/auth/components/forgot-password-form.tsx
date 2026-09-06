"use client";

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
import { Spinner } from "@workspace/ui/components/spinner";

import {
  ForgotPasswordDataTypes,
  forgotPasswordSchema,
} from "@workspace/schema/auth-schema";

import { useForgotPasswordMutation } from "../api/auth-api";
import { useResponseHandler } from "@/hooks/use-response-handler";
import { Link, useTransitionRouter } from "next-view-transitions";

import { BrandLogo } from "@/components/global/brand-logo";
import { useForm } from "react-hook-form";

export function ForgotPasswordForm() {
  const { handleApiResponse } = useResponseHandler();
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const router = useTransitionRouter();
  const form = useForm<ForgotPasswordDataTypes>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ForgotPasswordDataTypes) {
    await handleApiResponse(() => forgotPassword(data).unwrap(), {
      successMessage: "Password reset link sent to your email.",
      onSuccess() {
        form.reset();
        setTimeout(() => {
          router.push("/sign-in");
        }, 500);
      },
    });
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header with Logo */}
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandLogo className="h-8 mb-5" />
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-1.5 tracking-tight">
          Forgot Password
        </h1>
        <p className="text-xs text-muted-foreground font-light">
          Remembered your password?{" "}
          <Link
            href="/sign-in"
            className="text-primary font-semibold hover:underline"
          >
            Sign In
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

          <Button
            type="submit"
            size="lg"
            className="
              mt-6 w-full rounded-full h-11
              bg-primary hover:bg-primary/90
              text-primary-foreground font-semibold shadow-md shadow-primary/20
              transition-all duration-300 cursor-pointer
            "
            disabled={isLoading}
          >
            {isLoading ? <Spinner /> : "Send Reset Link"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
