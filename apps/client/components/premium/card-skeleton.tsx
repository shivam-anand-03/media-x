"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A card-shaped loading placeholder that matches the real card's footprint,
 * so lists don't jump when data arrives.
 */
export function CardSkeleton({
  className,
  lines = 3,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5",
        className,
      )}
    >
      {/* Sheen sweeping across the placeholder. */}
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full animate-[shimmer-slide_1.6s_infinite] bg-linear-to-r from-transparent via-foreground/5 to-transparent"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/5 rounded-md bg-muted" />
          <div className="h-3 w-1/4 rounded-md bg-muted/70" />
        </div>
        <div className="size-9 shrink-0 rounded-xl bg-muted" />
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded-md bg-muted/60"
            style={{ width: `${90 - i * 18}%` }}
          />
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-16 rounded-full bg-muted/70" />
        <div className="h-5 w-14 rounded-full bg-muted/70" />
      </div>
    </div>
  );
}

/** A responsive grid of `CardSkeleton`s for list/grid pages. */
export function CardSkeletonGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export default CardSkeleton;
