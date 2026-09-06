"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

interface ShineBorderProps extends React.ComponentProps<"div"> {
  /** Border thickness in pixels. */
  borderWidth?: number;
  /** Seconds for one full sweep. */
  duration?: number;
  /** One or more colours the sheen cycles through. */
  shineColor?: string | string[];
}

/**
 * An animated gradient sheen painted onto a container's border.
 *
 * The parent must be `relative` with a radius; this overlay inherits it.
 * Colours default to brand tokens so light and dark both look intentional.
 */
export function ShineBorder({
  className,
  borderWidth = 1,
  duration = 14,
  shineColor = ["var(--primary)", "var(--brand-pink)", "var(--brand-bright)"],
  style,
  ...props
}: ShineBorderProps) {
  const colors = Array.isArray(shineColor) ? shineColor : [shineColor];

  return (
    <div
      data-slot="magic-motion"
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 size-full rounded-[inherit] will-change-[background-position] motion-safe:animate-shine",
        className,
      )}
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          backgroundImage: `radial-gradient(transparent, transparent, ${colors.join(",")}, transparent, transparent)`,
          backgroundSize: "300% 300%",
          mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "var(--border-width)",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export default ShineBorder;
