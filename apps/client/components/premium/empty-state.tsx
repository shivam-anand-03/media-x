"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Ripple } from "@workspace/ui/components/magicui/ripple";

interface PremiumEmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Turn off the ripple backdrop for empty states inside tight panels. */
  quiet?: boolean;
}

/**
 * The house empty state: a haloed icon, a short explanation and one action.
 * Used wherever a list can legitimately be empty, so "nothing here" always
 * looks deliberate instead of broken.
 */
export function PremiumEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  quiet = false,
}: PremiumEmptyStateProps) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-col items-center justify-center overflow-hidden rounded-2xl px-6 py-12 text-center",
        className,
      )}
    >
      {!quiet && <Ripple className="text-primary/25" mainCircleSize={140} />}

      {Icon && (
        <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="size-6" />
        </span>
      )}
      <p className="text-sm font-bold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed font-light text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default PremiumEmptyState;
