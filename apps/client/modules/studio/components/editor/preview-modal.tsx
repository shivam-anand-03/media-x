"use client";

import * as React from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { formatTimecode, type ProjectDocument } from "@workspace/motion";
import { AdvertisementStage } from "@workspace/renderer/preview";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";

/**
 * Immersive preview (§28).
 *
 * Renders through `AdvertisementStage` — the exact component the Remotion
 * composition uses — so what plays here is what gets encoded. It runs its own
 * clock rather than borrowing the editor's, which keeps previewing from
 * scrubbing the user's playhead out from under them.
 */
export function PreviewModal({
  open,
  onClose,
  document: doc,
}: {
  open: boolean;
  onClose: () => void;
  document: ProjectDocument | null;
}) {
  const [time, setTime] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [scale, setScale] = React.useState(1);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastRef = React.useRef<number | null>(null);
  const audioPool = React.useRef<Map<string, HTMLAudioElement>>(new Map());

  const duration = doc?.canvas.duration ?? 0;

  // Restart from the top each time the preview opens.
  React.useEffect(() => {
    if (open) {
      setTime(0);
      setPlaying(true);
      lastRef.current = null;
    }
  }, [open]);

  // Fit the artboard to the available space.
  React.useEffect(() => {
    if (!open || !doc) return;
    const element = frameRef.current;
    if (!element) return;

    const fit = () => {
      const rect = element.getBoundingClientRect();
      setScale(Math.min(rect.width / doc.canvas.width, rect.height / doc.canvas.height));
    };
    fit();

    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, doc]);

  // The clock.
  React.useEffect(() => {
    if (!open || !playing || !doc) {
      lastRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastRef.current === null) lastRef.current = now;
      const delta = (now - lastRef.current) / 1000;
      lastRef.current = now;

      setTime((current) => {
        const next = current + delta;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [open, playing, doc, duration]);

  // Audio, kept in step with the preview's own clock.
  React.useEffect(() => {
    const pool = audioPool.current;
    if (!open || !doc) {
      for (const el of pool.values()) el.pause();
      return;
    }

    for (const track of doc.audioTracks) {
      let el = pool.get(track.id);
      if (!el) {
        // See use-playback.ts: no crossOrigin, and src assigned after the
        // element is configured.
        el = new Audio();
        el.preload = "auto";
        el.src = track.src;
        pool.set(track.id, el);
      }

      const local = time - track.startTime;
      const active = playing && local >= 0 && local < track.duration && !track.muted;

      if (!active) {
        if (!el.paused) el.pause();
        continue;
      }

      const target = track.trimStart + local;
      if (Math.abs(el.currentTime - target) > 0.25) el.currentTime = target;

      let gain = track.volume;
      if (track.fadeIn > 0 && local < track.fadeIn) gain *= local / track.fadeIn;
      const remaining = track.duration - local;
      if (track.fadeOut > 0 && remaining < track.fadeOut) gain *= remaining / track.fadeOut;
      el.volume = Math.max(0, Math.min(1, gain));

      if (el.paused) {
        void el.play().catch((error: unknown) => {
          console.warn(`[preview audio] could not play "${track.name}":`, error);
        });
      }
    }
  }, [open, doc, time, playing]);

  // Release audio elements when the preview closes.
  React.useEffect(() => {
    if (open) return;
    const pool = audioPool.current;
    for (const el of pool.values()) {
      el.pause();
      el.src = "";
    }
    pool.clear();
  }, [open]);

  // Escape closes, Space toggles.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((p) => !p);
      }
    };
    // Capture so the editor's global shortcuts don't also fire.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || !doc) return null;

  const restart = () => {
    setTime(0);
    lastRef.current = null;
    setPlaying(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Advertisement preview"
      className="fixed inset-0 z-50 flex flex-col bg-[oklch(0.09_0.006_80)]/97 backdrop-blur-sm"
    >
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="text-xs font-semibold tracking-wide text-white/70">Preview</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="gap-1.5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
          Exit preview
        </Button>
      </header>

      <div ref={frameRef} className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div
          className="overflow-hidden rounded-lg shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)]"
          style={{ width: doc.canvas.width * scale, height: doc.canvas.height * scale }}
        >
          {/* The stage renders at native resolution and is scaled down as a
              whole, so text and layout are identical to the export. */}
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <AdvertisementStage document={doc} time={time} />
          </div>
        </div>
      </div>

      <footer className="shrink-0 px-4 pt-2 pb-6">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => setPlaying((p) => !p)}
            className="size-9 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            aria-label="Restart"
            onClick={restart}
            className="size-9 shrink-0 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <RotateCcw className="size-4" />
          </Button>

          <span className="shrink-0 font-mono text-[11px] text-white/70 tabular-nums">
            {formatTimecode(time)}
          </span>

          {/* Scrub bar */}
          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={time}
            aria-label="Seek"
            onChange={(e) => {
              setTime(Number(e.target.value));
              lastRef.current = null;
            }}
            className={cn(
              "h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/20",
              "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
              "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white",
            )}
            style={{
              background: `linear-gradient(to right, var(--primary) ${(time / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(time / (duration || 1)) * 100}%)`,
            }}
          />

          <span className="shrink-0 font-mono text-[11px] text-white/50 tabular-nums">
            {formatTimecode(duration)}
          </span>
        </div>
      </footer>
    </div>
  );
}
