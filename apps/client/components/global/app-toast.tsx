"use client";

import { AtSign } from "lucide-react";
import { toast } from "sonner";

export const successToast = (message: string) => {
  toast.success(message, {
    duration: 3000,
  });
};

export const errorToast = (message: string) => {
  toast.error(message, {
    duration: 5000,
  });
};

export const warningToast = (message: string) => {
  toast.warning(message, {
    duration: 4000,
  });
};

// Used when the current user is @mentioned in chat.
export const mentionToast = (title: string, description?: string) => {
  toast(title, {
    description,
    duration: 6000,
    icon: (
      <AtSign className="size-5 text-purple-500 dark:text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.3)] shrink-0" />
    ),
    className:
      "group-[.toaster]:border-purple-500/25 group-[.toaster]:bg-purple-500/[0.02] dark:group-[.toaster]:bg-purple-950/10 group-[.toaster]:shadow-[0_8px_30px_rgba(168,85,247,0.08)] dark:group-[.toaster]:shadow-[0_8px_30px_rgba(168,85,247,0.15)]",
  });
};
