"use client";

import * as React from "react";

/**
 * The time ruler.
 *
 * Tick spacing adapts to zoom so the labels stay readable instead of turning
 * into a solid bar: the interval is chosen from a fixed ladder such that
 * adjacent labels are always at least ~56px apart.
 */

const INTERVALS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
const MIN_LABEL_GAP = 56;

export function TimelineRuler({
  duration,
  pixelsPerSecond,
}: {
  duration: number;
  pixelsPerSecond: number;
}) {
  const { major, minor } = React.useMemo(() => {
    const step = INTERVALS.find((i) => i * pixelsPerSecond >= MIN_LABEL_GAP) ?? 60;
    return { major: step, minor: step / 5 };
  }, [pixelsPerSecond]);

  const ticks = React.useMemo(() => {
    const result: { time: number; isMajor: boolean }[] = [];
    // Rounded to avoid floating-point drift accumulating across many ticks.
    const count = Math.floor(duration / minor + 1e-6);
    for (let i = 0; i <= count; i++) {
      const time = Math.round(i * minor * 1000) / 1000;
      result.push({ time, isMajor: Math.abs(time % major) < 1e-6 });
    }
    return result;
  }, [duration, major, minor]);

  return (
    <div className="relative h-7 border-b border-border/70 bg-muted/30 select-none">
      {ticks.map(({ time, isMajor }) => (
        <React.Fragment key={time}>
          <span
            aria-hidden
            className={isMajor ? "absolute bottom-0 w-px bg-border" : "absolute bottom-0 w-px bg-border/50"}
            style={{ left: time * pixelsPerSecond, height: isMajor ? 10 : 5 }}
          />
          {isMajor && (
            <span
              className="absolute top-1 text-[10px] font-medium tabular-nums text-muted-foreground"
              style={{ left: time * pixelsPerSecond + 4 }}
            >
              {formatTick(time)}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/** `0s`, `2.5s`, `1:05` — whichever reads most naturally at this zoom. */
function formatTick(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(seconds < 1 ? 2 : 1)}s`;
}
