"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

interface AnimatedShinyTextProps extends React.ComponentProps<"span"> {
  /** Width of the travelling highlight, in pixels. */
  shimmerWidth?: number;
}

/**
 * Text with a highlight that sweeps across it — for eyebrow labels and pills.
 *
 * The base tint is `--muted-foreground` and the highlight is `--foreground`,
 * both theme tokens, so it reads correctly on light and dark surfaces.
 */
export function AnimatedShinyText({
  children,
  className,
  shimmerWidth = 100,
  style,
  ...props
}: AnimatedShinyTextProps) {
  return (
    <span
      data-slot="magic-motion"
      style={
        {
          "--shiny-width": `${shimmerWidth}px`,
          ...style,
        } as React.CSSProperties
      }
      className={cn(
        "mx-auto max-w-md text-muted-foreground/70",
        // The highlight is a moving background clipped to the glyphs.
        "animate-shiny-text bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shiny-width)_100%] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]",
        "bg-linear-to-r from-transparent via-foreground via-50% to-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default AnimatedShinyText;
