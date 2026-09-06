"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

interface RippleProps extends React.ComponentProps<"div"> {
  mainCircleSize?: number;
  mainCircleOpacity?: number;
  numCircles?: number;
}

/**
 * Concentric rings that breathe outward — a calm focal point behind empty
 * states and "listening"/"processing" indicators. Border colour comes from
 * `--primary` via `currentColor`.
 */
export function Ripple({
  mainCircleSize = 210,
  mainCircleOpacity = 0.22,
  numCircles = 8,
  className,
  ...props
}: RippleProps) {
  return (
    <div
      aria-hidden
      data-slot="magic-motion"
      className={cn(
        "pointer-events-none absolute inset-0 select-none mask-[linear-gradient(to_bottom,#000,transparent)]",
        className,
      )}
      {...props}
    >
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * 70;
        const opacity = Math.max(mainCircleOpacity - i * 0.03, 0);
        const animationDelay = `${i * 0.06}s`;

        return (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 animate-ripple rounded-full border border-current bg-current/10 shadow-xl"
            style={
              {
                width: `${size}px`,
                height: `${size}px`,
                opacity,
                animationDelay,
                borderStyle: i === numCircles - 1 ? "dashed" : "solid",
                transform: "translate(-50%, -50%) scale(1)",
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

export default Ripple;
