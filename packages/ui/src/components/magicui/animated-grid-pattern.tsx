"use client";

import * as React from "react";
import { motion } from "motion/react";

import { cn } from "@workspace/ui/lib/utils";

interface AnimatedGridPatternProps extends React.ComponentProps<"svg"> {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: number;
  /** How many cells glow at once. */
  numSquares?: number;
  /** Peak opacity of a glowing cell. */
  maxOpacity?: number;
  /** Seconds for one fade cycle. */
  duration?: number;
  repeatDelay?: number;
}

/**
 * A blueprint grid where a handful of cells breathe in and out at random.
 *
 * Colour comes from `currentColor` — set `text-primary` (or any token colour)
 * on this element and it inherits the active theme.
 */
export function AnimatedGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = 0,
  numSquares = 24,
  className,
  maxOpacity = 0.35,
  duration = 4,
  ...props
}: AnimatedGridPatternProps) {
  const id = React.useId();
  const containerRef = React.useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

  const getPos = React.useCallback(
    (): [number, number] => [
      Math.floor((Math.random() * dimensions.width) / width),
      Math.floor((Math.random() * dimensions.height) / height),
    ],
    [dimensions.width, dimensions.height, width, height],
  );

  const [squares, setSquares] = React.useState<
    Array<{ id: number; pos: [number, number] }>
  >([]);

  // Cells are only generated once we know the container size, so the pattern
  // always covers the surface no matter how the parent is laid out.
  React.useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;
    setSquares(
      Array.from({ length: numSquares }, (_, i) => ({ id: i, pos: getPos() })),
    );
  }, [dimensions, numSquares, getPos]);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Re-roll a cell's position after its fade completes so the texture keeps
  // shifting instead of pulsing in the same places forever.
  const reroll = (id: number) =>
    setSquares((current) =>
      current.map((sq) => (sq.id === id ? { ...sq, pos: getPos() } : sq)),
    );

  return (
    <svg
      ref={containerRef}
      aria-hidden
      data-slot="magic-motion"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-current/[0.03] stroke-current/20",
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
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      <svg x={x} y={y} className="overflow-visible">
        {squares.map(({ pos: [px, py], id: sqId }, index) => (
          <motion.rect
            initial={{ opacity: 0 }}
            animate={{ opacity: maxOpacity }}
            transition={{
              duration,
              repeat: Infinity,
              repeatType: "reverse",
              delay: index * 0.1,
              repeatDelay: 1,
            }}
            onAnimationComplete={() => reroll(sqId)}
            key={`${px}-${py}-${index}`}
            width={width - 1}
            height={height - 1}
            x={px * width + 1}
            y={py * height + 1}
            fill="currentColor"
            strokeWidth="0"
          />
        ))}
      </svg>
    </svg>
  );
}

export default AnimatedGridPattern;
