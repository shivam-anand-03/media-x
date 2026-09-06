"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

interface DotPatternProps extends React.ComponentProps<"svg"> {
  width?: number;
  height?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  /** Fade the dots out toward the edges of the container. */
  glow?: boolean;
}

/**
 * A dotted background texture. Colour comes from `currentColor`, so set a
 * token text colour on the element (e.g. `text-primary/30`).
 */
export function DotPattern({
  width = 16,
  height = 16,
  cx = 1,
  cy = 1,
  cr = 1,
  glow = false,
  className,
  ...props
}: DotPatternProps) {
  const id = React.useId();

  return (
    <svg
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-current",
        glow &&
          "mask-[radial-gradient(ellipse_at_center,#000_10%,transparent_75%)]",
        className,
      )}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
        >
          <circle cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  );
}

export default DotPattern;
