"use client";

import * as React from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";

import { cn } from "@workspace/ui/lib/utils";

interface MagicCardProps extends React.ComponentProps<"div"> {
  /** Radius of the cursor spotlight, in pixels. */
  gradientSize?: number;
  /** Spotlight colour — defaults to the brand token. */
  gradientColor?: string;
  /** Spotlight opacity at its centre. */
  gradientOpacity?: number;
  /** Border sheen start colour. */
  gradientFrom?: string;
  /** Border sheen end colour. */
  gradientTo?: string;
}

/**
 * A card whose border and surface light up under the cursor.
 *
 * Both the glow and the border sheen read from theme tokens, so the effect
 * stays on-brand in light and dark without hardcoding a single hex value.
 */
export function MagicCard({
  children,
  className,
  gradientSize = 220,
  gradientColor = "var(--primary)",
  gradientOpacity = 0.12,
  gradientFrom = "var(--primary)",
  gradientTo = "var(--brand-pink)",
  ...props
}: MagicCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(-gradientSize * 10);
  const mouseY = useMotionValue(-gradientSize * 10);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    },
    [mouseX, mouseY],
  );

  const handleMouseLeave = React.useCallback(() => {
    mouseX.set(-gradientSize * 10);
    mouseY.set(-gradientSize * 10);
  }, [gradientSize, mouseX, mouseY]);

  const borderBackground = useMotionTemplate`
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientFrom}, ${gradientTo}, var(--border) 100%)
  `;
  const glowBackground = useMotionTemplate`
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 100%)
  `;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "group relative isolate rounded-[inherit] transition-transform duration-300 ease-out",
        className,
      )}
      {...props}
    >
      {/* Border sheen — sits behind the surface and shows through the 1px gap. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0 duration-500 group-hover:opacity-100"
        style={{ background: borderBackground }}
      />
      {/* Surface — inset by the border width so the sheen reads as a border. */}
      <div className="absolute inset-px -z-10 rounded-[inherit] bg-card" />
      {/* Cursor glow on the surface itself. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-px -z-10 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: glowBackground, opacity: gradientOpacity }}
      />
      {children}
    </div>
  );
}

export default MagicCard;
