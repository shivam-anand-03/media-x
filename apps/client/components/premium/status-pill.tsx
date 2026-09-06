"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type PillTone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

const toneClass: Record<PillTone, string> = {
  brand: "bg-primary/10 text-primary ring-primary/20",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/25",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  info: "bg-info/10 text-info ring-info/20",
  neutral: "bg-muted text-muted-foreground ring-border",
};

const dotClass: Record<PillTone, string> = {
  brand: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

interface StatusPillProps extends React.ComponentProps<"span"> {
  tone?: PillTone;
  /** Show a leading status dot. */
  dot?: boolean;
  /** Make the dot pulse — for live/in-progress states. */
  pulse?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * The one status chip used for every state label in the app (verified, live,
 * pending, rejected...). Tones map straight onto the semantic theme tokens.
 */
export function StatusPill({
  tone = "neutral",
  dot = false,
  pulse = false,
  icon: Icon,
  className,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] uppercase ring-1 ring-inset",
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && (
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-70",
                dotClass[tone],
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex size-1.5 rounded-full",
              dotClass[tone],
            )}
          />
        </span>
      )}
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}

export default StatusPill;
