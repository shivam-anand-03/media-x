"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

interface MeteorsProps {
  number?: number;
  minDelay?: number;
  maxDelay?: number;
  minDuration?: number;
  maxDuration?: number;
  /** Travel angle in degrees. */
  angle?: number;
  className?: string;
}

/**
 * Streaks of light falling across a dark hero surface.
 * Tinted with `--primary`, so it stays on-brand rather than plain white.
 */
export function Meteors({
  number = 14,
  minDelay = 0.2,
  maxDelay = 1.2,
  minDuration = 2,
  maxDuration = 10,
  angle = 215,
  className,
}: MeteorsProps) {
  const [meteors, setMeteors] = React.useState<React.CSSProperties[]>([]);

  // Positions are randomised on the client only — generating them during render
  // would produce a server/client mismatch.
  React.useEffect(() => {
    setMeteors(
      Array.from({ length: number }, () => ({
        "--angle": `${-angle}deg`,
        top: "-5%",
        left: `${Math.floor(Math.random() * 100)}%`,
        animationDelay: `${Math.random() * (maxDelay - minDelay) + minDelay}s`,
        animationDuration: `${Math.floor(Math.random() * (maxDuration - minDuration) + minDuration)}s`,
      })) as React.CSSProperties[],
    );
  }, [number, minDelay, maxDelay, minDuration, maxDuration, angle]);

  return (
    <div
      aria-hidden
      data-slot="magic-motion"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {meteors.map((style, idx) => (
        <span
          key={idx}
          style={style}
          className={cn(
            "pointer-events-none absolute size-0.5 rotate-[var(--angle)] animate-meteor rounded-full bg-primary shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_20%,transparent)]",
            className,
          )}
        >
          <div className="pointer-events-none absolute top-1/2 -z-10 h-px w-12 -translate-y-1/2 bg-linear-to-r from-primary to-transparent" />
        </span>
      ))}
    </div>
  );
}

export default Meteors;
