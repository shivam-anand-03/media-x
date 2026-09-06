"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

interface GridPatternProps extends React.ComponentProps<"svg"> {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  /** `[x, y]` cells to fill, for a subtle blueprint texture. */
  squares?: Array<[x: number, y: number]>;
  strokeDasharray?: string;
}

/**
 * A static blueprint grid used as a background texture on hero surfaces.
 *
 * Renders in `currentColor`, so control it with a text-* utility on the parent
 * (e.g. `text-border`) rather than a hardcoded stroke.
 */
export function GridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = "0",
  squares,
  className,
  ...props
}: GridPatternProps) {
  const id = React.useId();

  return (
    <svg
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-current/[0.04] stroke-current/20",
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
          x={x}
          y={y}
        >
          <path
            d={`M.5 ${height}V.5H${width}`}
            fill="none"
            strokeDasharray={strokeDasharray}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
      {squares && (
        <svg x={x} y={y} className="overflow-visible">
          {squares.map(([sx, sy]) => (
            <rect
              strokeWidth="0"
              key={`${sx}-${sy}`}
              width={width - 1}
              height={height - 1}
              x={sx * width + 1}
              y={sy * height + 1}
            />
          ))}
        </svg>
      )}
    </svg>
  );
}

export default GridPattern;
