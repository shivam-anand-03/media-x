"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

interface BorderBeamProps extends React.ComponentProps<"div"> {
  /** Length of the travelling light, in pixels. */
  size?: number;
  /** Seconds for one full lap around the border. */
  duration?: number;
  /** Seconds to wait before this beam starts (stagger multiple beams). */
  delay?: number;
  /** Border thickness in pixels. */
  borderWidth?: number;
  /** Head colour of the beam. Defaults to the brand token. */
  colorFrom?: string;
  /** Tail colour of the beam. Defaults to the accent-brand token. */
  colorTo?: string;
  /** Travel anti-clockwise instead. */
  reverse?: boolean;
}

/**
 * A light that travels around a container's border.
 *
 * Colours default to `--primary` / `--brand-pink` so the beam always tracks the
 * active theme; pass `colorFrom`/`colorTo` only to override with another token.
 * The parent must be `relative` and (usually) `overflow-hidden`.
 */
export function BorderBeam({
  className,
  size = 60,
  duration = 8,
  delay = 0,
  borderWidth = 1.5,
  colorFrom = "var(--primary)",
  colorTo = "var(--brand-pink)",
  reverse = false,
  style,
  ...props
}: BorderBeamProps) {
  return (
    <div
      data-slot="magic-motion"
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        "border-(length:--border-beam-width) border-transparent",
        "[mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]",
        className,
      )}
      style={
        {
          "--border-beam-width": `${borderWidth}px`,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <div
        className={cn(
          "absolute aspect-square animate-border-beam",
          "bg-linear-to-l from-(--beam-from) via-(--beam-to) to-transparent",
          "[offset-anchor:calc(var(--beam-size)*-1)_50%] [offset-path:rect(0_auto_auto_0_round_calc(var(--beam-size)*1px))]",
        )}
        style={
          {
            "--beam-size": size,
            "--beam-from": colorFrom,
            "--beam-to": colorTo,
            "--duration": duration,
            width: size,
            animationDelay: `${delay}s`,
            animationDirection: reverse ? "reverse" : "normal",
          } as React.CSSProperties
        }
      />
    </div>
  );
}

export default BorderBeam;
