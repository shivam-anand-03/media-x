"use client";

import * as React from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  /** Rendered as a pill on the right of the label. */
  count?: number;
}

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Shared layout id — give each TabBar on a page its own. */
  layoutId?: string;
}

/**
 * A segmented tab bar where the active pill slides between options.
 *
 * Used for in-page section switching (contract states, message folders) so
 * changing view reads as movement rather than a hard repaint.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  className,
  layoutId = "premium-tab-indicator",
}: TabBarProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-muted/50 p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-colors duration-200",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-card shadow-[0_1px_2px_color-mix(in_oklab,var(--foreground)_8%,transparent)] ring-1 ring-border"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {tab.label}
              {typeof tab.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    active
                      ? "bg-primary/15 text-primary"
                      : "bg-muted-foreground/15 text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default TabBar;
