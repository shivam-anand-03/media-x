"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { NumberTicker } from "@workspace/ui/components/magicui/number-ticker";

interface StatTileProps {
  label: string;
  /** A number animates via the ticker; anything else renders as-is. */
  value: React.ReactNode;
  /** Suffix pinned to the value, e.g. "%" or "hrs". */
  suffix?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Signed percentage change; renders a coloured delta chip. */
  delta?: number;
  /** Stagger index — drives the reveal delay so a row cascades. */
  index?: number;
  className?: string;
}

/**
 * A single metric in a stats strip: animated figure, label, optional delta.
 * Numbers count up on first view so a dashboard feels live on load.
 */
export function StatTile({
  label,
  value,
  suffix,
  hint,
  icon: Icon,
  delta,
  className,
}: StatTileProps) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" &&
          value.trim() !== "" &&
          !isNaN(Number(value))
        ? Number(value)
        : null;

  const DeltaIcon = (delta ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={cn(
        "group relative isolate overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-4 backdrop-blur-sm",
        "transition-[transform,border-color,background-color] duration-300 ease-out",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card",
        className,
      )}
    >
      {/* Brand underline that fills in on hover. */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px w-0 bg-linear-to-r from-primary to-brand-pink transition-all duration-500 group-hover:w-full"
      />

      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </span>
        {Icon && (
          <Icon className="size-4 shrink-0 text-primary/70 transition-colors group-hover:text-primary" />
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl leading-none font-extrabold tracking-tight text-foreground tabular-nums">
          {numeric !== null ? <NumberTicker value={numeric} /> : value}
        </span>
        {suffix && (
          <span className="text-xs font-bold text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              delta >= 0
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive",
            )}
          >
            <DeltaIcon className="size-3" />
            {Math.abs(delta)}%
          </span>
        )}
        {hint && (
          <span className="truncate text-[11px] font-light text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatTile;
