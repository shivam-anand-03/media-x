"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { BlurFade } from "@workspace/ui/components/magicui/blur-fade";
import { AnimatedGridPattern } from "@workspace/ui/components/magicui/animated-grid-pattern";

interface PageHeaderProps {
  /** Small label above the title — usually the section name. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons/links rendered on the right (stacked below on mobile). */
  actions?: React.ReactNode;
  /** A metric strip, tabs or chips rendered under the divider. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The standard page masthead: blueprint-grid backdrop, eyebrow, title,
 * supporting copy and right-aligned actions.
 *
 * Used at the top of every primary page so the app has one recognisable
 * entry rhythm instead of a different header per screen.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "relative isolate overflow-hidden rounded-3xl border border-border/70",
        "bg-linear-to-br from-primary/8 via-card to-brand-pink/5 dark:from-primary/14 dark:via-card dark:to-brand-pink/8",
        "px-5 py-6 sm:px-7 sm:py-8",
        "shadow-[0_1px_2px_color-mix(in_oklab,var(--foreground)_4%,transparent),0_18px_44px_-24px_color-mix(in_oklab,var(--primary)_30%,transparent)]",
        className,
      )}
    >
      {/* Blueprint grid + soft brand bloom, both token-coloured. */}
      <AnimatedGridPattern
        numSquares={18}
        maxOpacity={0.06}
        duration={5}
        className="inset-x-0 -top-1/3 h-[180%] skew-y-6 text-primary mask-[radial-gradient(520px_circle_at_center,#000,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-primary/10 blur-[90px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-10 -z-10 size-72 rounded-full bg-brand-pink/10 blur-[100px]"
      />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <BlurFade className="min-w-0 space-y-2">
            {eyebrow && (
              <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
                {eyebrow}
              </div>
            )}
            <h1 className="text-2xl leading-tight font-extrabold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </BlurFade>

          {actions && (
            <BlurFade delay={0.08} className="flex shrink-0 flex-wrap gap-2">
              {actions}
            </BlurFade>
          )}
        </div>

        {children && (
          <>
            <div className="h-px w-full bg-linear-to-r from-border via-border/60 to-transparent" />
            <BlurFade delay={0.14}>{children}</BlurFade>
          </>
        )}
      </div>
    </header>
  );
}

export default PageHeader;
