"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  type Variants,
} from "motion/react";

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  /** Override the default blur-up variants. */
  variant?: Variants;
  /** Seconds the reveal takes. */
  duration?: number;
  /** Seconds to wait before revealing — multiply by an index to stagger a grid. */
  delay?: number;
  /** Pixels travelled during the reveal. */
  offset?: number;
  /** Slide direction. */
  direction?: "up" | "down" | "left" | "right";
  /** Reveal on scroll-into-view instead of on mount. */
  inView?: boolean;
  inViewMargin?: string;
  blur?: string;
  as?: "div" | "span" | "li" | "section" | "article";
}

/**
 * Reveals content with a soft blur-and-rise — the house transition for cards,
 * rows and section headers. Set `inView` for below-the-fold content so the
 * animation fires when it is actually seen.
 */
export function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  offset = 6,
  direction = "down",
  inView = false,
  inViewMargin = "-50px",
  blur = "6px",
  as = "div",
}: BlurFadeProps) {
  const ref = React.useRef<HTMLElement>(null);
  const inViewResult = useInView(ref as React.RefObject<Element>, {
    once: true,
    margin: inViewMargin as never,
  });
  const isInView = !inView || inViewResult;

  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const sign = direction === "right" || direction === "down" ? -1 : 1;

  const defaultVariants: Variants = {
    hidden: {
      [axis]: sign * offset,
      opacity: 0,
      filter: `blur(${blur})`,
    },
    visible: { [axis]: 0, opacity: 1, filter: "blur(0px)" },
  };

  const MotionTag = motion[as] as typeof motion.div;

  return (
    <AnimatePresence>
      <MotionTag
        ref={ref as React.RefObject<HTMLDivElement>}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        exit="hidden"
        variants={variant ?? defaultVariants}
        transition={{
          delay: 0.04 + delay,
          duration,
          ease: [0.21, 0.47, 0.32, 0.98],
        }}
        className={className}
      >
        {children}
      </MotionTag>
    </AnimatePresence>
  );
}

export default BlurFade;
