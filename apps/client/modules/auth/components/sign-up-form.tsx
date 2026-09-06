"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";

import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import Link from "next/link";
import { CountrySelect } from "./country-select";
import { SignUpDataTypes, signUpSchema } from "@workspace/schema/auth-schema";
import { useResponseHandler } from "@/hooks/use-response-handler";
import {
  successToast,
  errorToast,
} from "@/components/global/app-toast";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { Spinner } from "@workspace/ui/components/spinner";
import { useRegisterMutation } from "../api/auth-api";

export const SignUpForm = () => {
  const router = useRouter();
  const [register, { isLoading }] = useRegisterMutation();
  const { handleApiResponse } = useResponseHandler();

  const form = useForm<SignUpDataTypes>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      sendEmails: true,
      agreeToTerms: false,
      country: "",
      role: "USER",
    },
  });

  async function onSubmit(data: SignUpDataTypes) {
    if (!data.agreeToTerms) {
      errorToast("You must agree to the Terms of Service to continue.");
      return;
    }

    await handleApiResponse(() => register(data).unwrap(), {
      onSuccess: async (response) => {
        successToast(
          response?.message ||
            "Registration successful! Please check your email to verify.",
        );

        router.push(`/verify-user?email=${encodeURIComponent(data.email)}`);
      },

      onError: (error: any) => {
        const errorMessage =
          error?.data?.message ||
          error?.message ||
          "Registration failed. Please try again.";

        errorToast(errorMessage);
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium block text-xs mb-1">
                  First Name
                </FormLabel>
                <FormControl>
                  <Input
                    className="h-11 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-4 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    placeholder="John"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-500 dark:text-red-400 text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium block text-xs mb-1">
                  Last Name
                </FormLabel>
                <FormControl>
                  <Input
                    className="h-11 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-4 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    placeholder="Doe"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-500 dark:text-red-400 text-xs" />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium block text-xs mb-1">
                Email
              </FormLabel>
              <FormControl>
                <Input
                  className="h-11 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-4 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  placeholder="john@example.com"
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
              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium block text-xs mb-1">
                Password
              </FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="Enter Password (min 8 chars)"
                  className="h-11 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-4 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-red-500 dark:text-red-400 text-xs" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium block text-xs mb-1">
                Choose your country
              </FormLabel>
              <CountrySelect
                onValueChange={field.onChange}
                defaultValue={field.value ?? ""}
              />
              <FormMessage className="text-red-500 dark:text-red-400 text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sendEmails"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="border-slate-300 dark:border-slate-700"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-slate-600 dark:text-slate-400 text-xs font-normal">
                  Send me product updates, news, and notifications.
                </FormLabel>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="agreeToTerms"
          render={({ field }) => (
            <FormItem className="flex items-start gap-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-1 shrink-0 border-slate-300 dark:border-slate-700 bg-slate-50/50"
                />
              </FormControl>

              <div className="space-y-1 text-xs font-normal leading-normal">
                <p className="text-slate-600 dark:text-slate-400">
                  I agree to the{" "}
                  <Link
                    href="/terms"
                    className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                  >
                    Privacy Policy
                  </Link>
                </p>
                {form.formState.errors.agreeToTerms && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.agreeToTerms.message}
                  </p>
                )}
              </div>
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="
            mt-6 w-full rounded-full h-11
            bg-purple-600 hover:bg-purple-700
            dark:bg-purple-500 dark:hover:bg-purple-600
            text-white font-semibold shadow-md shadow-purple-500/10
            transition-all duration-300 cursor-pointer
          "
        >
          {isLoading ? <Spinner /> : "Sign Up"}
        </Button>
      </form>
    </Form>
  );
};
