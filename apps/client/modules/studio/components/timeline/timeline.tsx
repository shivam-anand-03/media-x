"use client";

import * as React from "react";
import { formatTimecode } from "@workspace/motion";
import {
  ChevronsLeftRight,
  Magnet,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useEditorStore } from "../../stores/editor-store";
import { TimelineRuler } from "./timeline-ruler";
import { TimelineTrack, TimelineAudioTrack } from "./timeline-track";

/**
 * The timeline (§17).
 *
 * It is the authoritative view of *when* things happen: every clip position and
 * width is derived from the layer's `startTime`/`duration`, and dragging one
 * writes straight back to the document. There is no separate timeline state to
 * fall out of sync with the canvas.
 *
 * Layout is a fixed-width track header column plus a shared horizontal scroll
 * area, so the ruler, the clips and the playhead all use one coordinate space.
 */

/** Base pixels per second at zoom 1. */
const BASE_PPS = 68;
const HEADER_WIDTH = 168;
const TRACK_HEIGHT = 34;

export function Timeline({ className }: { className?: string }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const doc = useEditorStore((s) => s.document);
  const timelineZoom = useEditorStore((s) => s.timelineZoom);
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const loopPlayback = useEditorStore((s) => s.loopPlayback);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);

  const duration = doc?.canvas.duration ?? 10;
  const fps = doc?.canvas.fps ?? 30;
  const pps = BASE_PPS * timelineZoom;
  const trackWidth = duration * pps;

  // Layers render top-to-bottom with the frontmost first, matching the layer
  // panel and how designers think about stacking.
  const orderedLayers = React.useMemo(
    () => (doc ? [...doc.layers].sort((a, b) => b.zIndex - a.zIndex) : []),
    [doc],
  );

  const seekFromPointer = React.useCallback(
    (clientX: number) => {
      const element = scrollRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const x = clientX - rect.left + element.scrollLeft;
      useEditorStore.getState().setCurrentTime(Math.max(0, Math.min(x / pps, duration)));
    },
    [pps, duration],
  );

  /** Scrubbing: pointer capture keeps the drag alive outside the ruler. */
  const handleScrub = React.useCallback(
    (event: React.PointerEvent) => {
      // Ignore drags that started on a clip.
      if ((event.target as HTMLElement).closest("[data-timeline-clip]")) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      seekFromPointer(event.clientX);

      const onMove = (moveEvent: PointerEvent) => seekFromPointer(moveEvent.clientX);
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [seekFromPointer],
  );

  // Keep the playhead in view during playback.
  React.useEffect(() => {
    if (!isPlaying) return;
    const element = scrollRef.current;
    if (!element) return;
    const playheadX = currentTime * pps;
    const { scrollLeft, clientWidth } = element;
    if (playheadX < scrollLeft || playheadX > scrollLeft + clientWidth - 80) {
      element.scrollLeft = Math.max(0, playheadX - clientWidth * 0.35);
    }
  }, [currentTime, isPlaying, pps]);

  const store = useEditorStore.getState;

  return (
    <section
      className={cn("flex min-h-0 flex-col border-t border-border bg-card", className)}
      aria-label="Timeline"
    >
      {/* ---- Transport ---- */}
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-border/70 px-2">
        <TransportButton label="Jump to start" onClick={() => store().setCurrentTime(0)}>
          <SkipBack className="size-4" />
        </TransportButton>

        <Button
          size="icon"
          variant="default"
          className="size-8 rounded-full"
          onClick={() => store().togglePlay()}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
        </Button>

        <TransportButton label="Jump to end" onClick={() => store().setCurrentTime(duration)}>
          <SkipForward className="size-4" />
        </TransportButton>

        <div className="mx-2 flex items-baseline gap-1 font-mono text-xs tabular-nums">
          <span className="font-semibold text-foreground">{formatTimecode(currentTime, true, fps)}</span>
          <span className="text-muted-foreground">/ {formatTimecode(duration)}</span>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <TransportButton
            label={loopPlayback ? "Looping on" : "Looping off"}
            active={loopPlayback}
            onClick={() => store().setLoopPlayback(!loopPlayback)}
          >
            <Repeat className="size-4" />
          </TransportButton>

          <TransportButton
            label={snapEnabled ? "Snapping on" : "Snapping off"}
            active={snapEnabled}
            onClick={() => store().toggleSnap()}
          >
            <Magnet className="size-4" />
          </TransportButton>

          <span className="mx-1 h-4 w-px bg-border" />

          <TransportButton
            label="Zoom out timeline"
            onClick={() => store().setTimelineZoom(timelineZoom / 1.35)}
          >
            <ZoomOut className="size-4" />
          </TransportButton>
          <TransportButton label="Fit timeline" onClick={() => store().setTimelineZoom(1)}>
            <ChevronsLeftRight className="size-4" />
          </TransportButton>
          <TransportButton
            label="Zoom in timeline"
            onClick={() => store().setTimelineZoom(timelineZoom * 1.35)}
          >
            <ZoomIn className="size-4" />
          </TransportButton>
        </div>
      </header>

      {/* ---- Tracks ---- */}
      <div className="flex min-h-0 flex-1">
        {/* Track headers — a fixed column that does not scroll horizontally. */}
        <div className="w-42 shrink-0 border-r border-border/70" style={{ width: HEADER_WIDTH }}>
          <div className="h-7 border-b border-border/70 bg-muted/30" />
          <div className="overflow-hidden">
            {orderedLayers.map((layer) => (
              <TrackHeader key={layer.id} id={layer.id} name={layer.name} type={layer.type} />
            ))}
            {doc?.audioTracks.map((track) => (
              <TrackHeader key={track.id} id={track.id} name={track.name} type="audio" isAudio />
            ))}
            {orderedLayers.length === 0 && !doc?.audioTracks.length && (
              <p className="px-3 py-4 text-[11px] leading-relaxed text-muted-foreground">
                Layers appear here as you add them.
              </p>
            )}
          </div>
        </div>

        {/* Scrolling lane area. */}
        <div ref={scrollRef} className="no-scrollbar relative min-w-0 flex-1 overflow-x-auto overflow-y-auto">
          <div style={{ width: Math.max(trackWidth, 320) }} className="relative">
            <div onPointerDown={handleScrub} className="sticky top-0 z-20 cursor-ew-resize">
              <TimelineRuler duration={duration} pixelsPerSecond={pps} />
            </div>

            <div onPointerDown={handleScrub} className="relative">
              {orderedLayers.map((layer) => (
                <TimelineTrack
                  key={layer.id}
                  layer={layer}
                  pixelsPerSecond={pps}
                  projectDuration={duration}
                  height={TRACK_HEIGHT}
                />
              ))}

              {doc?.audioTracks.map((track) => (
                <TimelineAudioTrack
                  key={track.id}
                  track={track}
                  pixelsPerSecond={pps}
                  projectDuration={duration}
                  height={TRACK_HEIGHT}
                />
              ))}

              {/* Fills the lane area so scrubbing works below the last track. */}
              <div style={{ height: 40 }} />
            </div>

            {/* Playhead spans the ruler and every track. */}
            <Playhead time={currentTime} pixelsPerSecond={pps} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TransportButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className={cn("size-8 text-muted-foreground", active && "bg-primary/12 text-primary")}
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const TYPE_DOT: Record<string, string> = {
  text: "bg-primary",
  image: "bg-info",
  video: "bg-brand-pink",
  shape: "bg-warning",
  icon: "bg-success",
  gradient: "bg-chart-5",
  audio: "bg-chart-2",
};

function TrackHeader({
  id,
  name,
  type,
  isAudio,
}: {
  id: string;
  name: string;
  type: string;
  isAudio?: boolean;
}) {
  const selected = useEditorStore((s) =>
    isAudio ? s.selectedAudioId === id : s.selectedLayerIds.includes(id),
  );

  return (
    <button
      type="button"
      onClick={() => {
        const store = useEditorStore.getState();
        if (isAudio) store.selectAudio(id);
        else store.selectLayer(id);
      }}
      className={cn(
        "flex w-full items-center gap-2 border-b border-border/40 px-3 text-left transition-colors",
        selected ? "bg-primary/10" : "hover:bg-muted/50",
      )}
      style={{ height: TRACK_HEIGHT }}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", TYPE_DOT[type] ?? "bg-muted-foreground")} />
      <span
        className={cn(
          "truncate text-[11px] font-medium",
          selected ? "text-primary" : "text-muted-foreground",
        )}
      >
        {name}
      </span>
    </button>
  );
}

function Playhead({ time, pixelsPerSecond }: { time: number; pixelsPerSecond: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-primary"
      style={{ transform: `translateX(${time * pixelsPerSecond}px)` }}
    >
      <span className="absolute -top-px -left-[5px] size-[11px] rounded-[3px] bg-primary shadow-sm" />
    </div>
  );
}
