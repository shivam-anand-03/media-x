"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Surface } from "./surface";

interface SectionCardProps extends Omit<
  React.ComponentProps<"section">,
  "title"
> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Right-aligned controls in the header row. */
  action?: React.ReactNode;
  /** Small label above the title. */
  eyebrow?: React.ReactNode;
  beam?: boolean;
  tone?: "card" | "muted" | "brand";
  /** Remove the body padding — for tables and full-bleed content. */
  flush?: boolean;
  contentClassName?: string;
}

/**
 * A titled panel: icon, heading, supporting copy, an action slot and a body.
 *
 * This is the workhorse container for dashboard sections, list panels and
 * form groups, so every section on every page frames its content the same way.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  eyebrow,
  beam,
  tone = "card",
  flush = false,
  className,
  contentClassName,
  children,
  ...props
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || action || eyebrow);

  return (
    <Surface
      tone={tone}
      beam={beam}
      className={cn("overflow-hidden", className)}
      {...(props as React.ComponentProps<"div">)}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-6",
            !flush && "pb-1",
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Icon className="size-5" />
              </span>
            )}
            <div className="min-w-0 space-y-0.5">
              {eyebrow && (
                <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h3 className="truncate text-base font-extrabold tracking-tight text-foreground">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs leading-relaxed font-light text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          </div>
          {action && <div className="flex shrink-0 gap-2">{action}</div>}
        </div>
      )}

      <div
        className={cn(
          !flush && "px-5 py-5 sm:px-6 sm:py-6",
          hasHeader && !flush && "pt-4",
          contentClassName,
        )}
      >
        {children}
      </div>
    </Surface>
  );
}

export default SectionCard;
