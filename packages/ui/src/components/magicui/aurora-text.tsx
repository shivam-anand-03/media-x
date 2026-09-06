"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

interface AuroraTextProps extends React.ComponentProps<"span"> {
  /** Colours the aurora drifts through. Defaults to the brand ramp. */
  colors?: string[];
  /** Higher is slower. */
  speed?: number;
}

/**
 * Headline text filled with a slowly drifting brand-coloured aurora.
 *
 * Inherits font size/weight from its parent — it only paints the glyphs, so
 * the app's typography scale is untouched.
 */
export function AuroraText({
  children,
  className,
  colors = [
    "var(--primary)",
    "var(--brand-pink)",
    "var(--brand-bright)",
    "var(--primary)",
  ],
  speed = 1,
  ...props
}: AuroraTextProps) {
  const gradientStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(135deg, ${colors.join(", ")}, ${colors[0]})`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    animationDuration: `${10 / speed}s`,
  };

  return (
    <span
      data-slot="magic-motion"
      className={cn("relative inline-block", className)}
      {...props}
    >
      <span className="sr-only">{children}</span>
      <span
        aria-hidden
        className="relative animate-aurora bg-[length:200%_auto] bg-clip-text text-transparent"
        style={gradientStyle}
      >
        {children}
      </span>
    </span>
  );
}

export default AuroraText;
