"use client";

import * as React from "react";
import { motion, type Variants } from "motion/react";

import { cn } from "@workspace/ui/lib/utils";

const containerVariants: Variants = {
  hidden: {},
  visible: (stagger: number) => ({
    transition: { staggerChildren: stagger, delayChildren: 0.04 },
  }),
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.42, ease: [0.21, 0.47, 0.32, 0.98] },
  },
};

/**
 * A container that reveals its children one after another.
 *
 * Wrap each child in `<AnimatedListItem>`; the stagger is driven by the parent
 * so adding or removing cards never needs delay maths at the call site.
 */
export function AnimatedList({
  children,
  className,
  stagger = 0.06,
  ...props
}: React.ComponentProps<typeof motion.div> & { stagger?: number }) {
  return (
    <motion.div
      data-slot="magic-motion"
      initial="hidden"
      animate="visible"
      custom={stagger}
      variants={containerVariants}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedListItem({
  children,
  className,
  ...props
}: React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div variants={itemVariants} className={cn(className)} {...props}>
      {children}
    </motion.div>
  );
}

export default AnimatedList;
