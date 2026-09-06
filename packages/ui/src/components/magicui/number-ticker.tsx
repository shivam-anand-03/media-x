"use client";

import * as React from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";

import { cn } from "@workspace/ui/lib/utils";

interface NumberTickerProps extends React.ComponentProps<"span"> {
  /** Target number to land on. */
  value: number;
  /** Where the count starts. */
  startValue?: number;
  /** Count down from `value` to `startValue` instead. */
  direction?: "up" | "down";
  /** Seconds to wait after entering the viewport. */
  delay?: number;
  /** Decimal places to render. */
  decimalPlaces?: number;
}

/**
 * Counts a number up (or down) once it scrolls into view.
 *
 * Falls back to rendering the final value immediately when the user prefers
 * reduced motion, so the figure is never hidden behind an animation.
 */
export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  decimalPlaces = 0,
  className,
  ...props
}: NumberTickerProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  const format = React.useCallback(
    (n: number) =>
      Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(Number(n.toFixed(decimalPlaces))),
    [decimalPlaces],
  );

  React.useEffect(() => {
    if (!isInView) return;
    const timer = setTimeout(() => {
      motionValue.set(direction === "down" ? startValue : value);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [motionValue, isInView, delay, value, direction, startValue]);

  React.useEffect(
    () =>
      springValue.on("change", (latest: number) => {
        if (ref.current) ref.current.textContent = format(latest);
      }),
    [springValue, format],
  );

  return (
    <span
      ref={ref}
      data-slot="magic-motion"
      className={cn("inline-block tabular-nums tracking-tight", className)}
      {...props}
    >
      {format(direction === "down" ? value : startValue)}
    </span>
  );
}

export default NumberTicker;
