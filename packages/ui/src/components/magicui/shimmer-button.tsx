"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

interface ShimmerButtonProps extends React.ComponentProps<"button"> {
  /** Colour of the rotating spark. */
  shimmerColor?: string;
  shimmerSize?: string;
  /** Seconds for one lap of the spark. */
  shimmerDuration?: string;
  borderRadius?: string;
  /** Button surface — a theme token by default. */
  background?: string;
}

/**
 * A primary CTA with a spark that orbits its border.
 *
 * Defaults to the `--primary` surface with `--primary-foreground` text so it
 * matches every other primary action in the app.
 */
export function ShimmerButton({
  shimmerColor = "var(--primary-foreground)",
  shimmerSize = "0.06em",
  shimmerDuration = "2.6s",
  borderRadius = "9999px",
  background = "var(--primary)",
  className,
  children,
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      data-slot="magic-motion"
      style={
        {
          "--spread": "90deg",
          "--shimmer-color": shimmerColor,
          "--radius": borderRadius,
          "--speed": shimmerDuration,
          "--cut": shimmerSize,
          "--bg": background,
        } as React.CSSProperties
      }
      className={cn(
        "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-primary/20 px-6 py-3 text-primary-foreground [background:var(--bg)] [border-radius:var(--radius)]",
        "transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px",
        "hover:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]",
        className,
      )}
      {...props}
    >
      {/* Orbiting spark, masked to a hairline so it reads as a moving border. */}
      <div className="-z-30 blur-[2px] absolute inset-0 overflow-visible [container-type:size]">
        <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
          <div className="absolute inset-[-100%] w-auto rotate-0 animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>
      {children}
      {/* Highlight */}
      <div
        className={cn(
          "insert-0 absolute size-full",
          "rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_color-mix(in_oklab,var(--primary-foreground)_12%,transparent)]",
          "transform-gpu transition-all duration-300 ease-in-out",
          "group-hover:shadow-[inset_0_-6px_10px_color-mix(in_oklab,var(--primary-foreground)_25%,transparent)]",
          "group-active:shadow-[inset_0_-10px_10px_color-mix(in_oklab,var(--primary-foreground)_25%,transparent)]",
        )}
      />
      {/* Backdrop that hides the spark everywhere except the border gap. */}
      <div className="absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]" />
    </button>
  );
}

export default ShimmerButton;
