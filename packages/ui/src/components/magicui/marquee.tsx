"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

interface MarqueeProps extends React.ComponentProps<"div"> {
  /** Scroll the other way. */
  reverse?: boolean;
  /** Pause while the cursor is over the track. */
  pauseOnHover?: boolean;
  /** Scroll top-to-bottom instead of left-to-right. */
  vertical?: boolean;
  /** How many times the children are duplicated to fill the track. */
  repeat?: number;
}

/**
 * An infinite scrolling track — used for skill chips and logo rows.
 * Fade the edges with a mask utility on the parent.
 */
export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}: MarqueeProps) {
  return (
    <div
      data-slot="magic-motion"
      className={cn(
        "group flex overflow-hidden p-2 [--duration:40s] [--gap:1rem] [gap:var(--gap)]",
        vertical ? "flex-col" : "flex-row",
        className,
      )}
      {...props}
    >
      {Array.from({ length: repeat }, (_, i) => (
        <div
          key={i}
          className={cn("flex shrink-0 justify-around [gap:var(--gap)]", {
            "animate-marquee flex-row": !vertical,
            "animate-marquee-vertical flex-col": vertical,
            "group-hover:[animation-play-state:paused]": pauseOnHover,
            "[animation-direction:reverse]": reverse,
          })}
        >
          {children}
        </div>
      ))}
    </div>
  );
}

export default Marquee;
