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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp";
import {
  OtpVerifyDataTypes,
  otpVerifySchema,
} from "@workspace/schema/auth-schema";
import { useSearchParams } from "next/navigation";
import { useResponseHandler } from "@/hooks/use-response-handler";
import { useReadLocalStorage } from "usehooks-ts";
import { useVerifyOtpMutation } from "../api/auth-api";
import { useTransitionRouter } from "next-view-transitions";
import { Spinner } from "@workspace/ui/components/spinner";
import { successToast } from "@/components/global/app-toast";

export function InputOTPForm({ onResend }: { onResend: () => void }) {
  const { handleApiResponse } = useResponseHandler();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [verifyOtp, { isLoading }] = useVerifyOtpMutation();
  const router = useTransitionRouter();

  const form = useForm<OtpVerifyDataTypes>({
    resolver: zodResolver(otpVerifySchema),
    defaultValues: {
      otp: "",
    },
  });

  async function onSubmit(data: OtpVerifyDataTypes) {
    await handleApiResponse(
      () => verifyOtp({ otp: data.otp, email }).unwrap(),
      {
        onSuccess() {
          successToast("OTP verified successfully");
          form.reset();
          router.push("/sign-in");
        },
      },
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="otp"
          render={({ field }) => (
            <FormItem className="space-y-4">
              <FormControl>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} {...field}>
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className="
                            h-12 w-12 text-lg font-bold
                            rounded-md
                            bg-muted/40
                            text-foreground
                            border border-border
                            shadow-inner
                            transition-all
                            hover:border-primary
                            focus-visible:border-primary
                            focus-visible:ring-2 focus-visible:ring-ring/25
                          "
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </FormControl>

              <FormMessage className="text-center text-destructive text-xs" />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-2.5 font-bold text-xs shadow-md shadow-primary/20 transition-all duration-200 active:scale-98 cursor-pointer"
        >
          {isLoading ? <Spinner /> : "Verify"}
        </Button>
      </form>
    </Form>
  );
}
