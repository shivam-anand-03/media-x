"use client";

import * as React from "react";
import type { AudioTrack, Layer } from "@workspace/motion";
import { Lock, Music4, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "../../stores/editor-store";
import { snapValue } from "../../lib/snapping";

/**
 * A timeline lane and its clip.
 *
 * Dragging the clip body moves `startTime`; dragging either edge resizes
 * `duration` while pinning the opposite edge. Both write through the store's
 * timing actions, which clamp to the project bounds — so a clip can never be
 * dragged out of the exported video.
 *
 * The whole gesture is wrapped in `beginInteraction`/`endInteraction` so it
 * collapses to a single undo step.
 */

type DragMode = "move" | "resize-start" | "resize-end";

/** Snap distance in pixels, converted to seconds at the current zoom. */
const SNAP_PX = 8;

const TYPE_STYLES: Record<Layer["type"], string> = {
  text: "bg-primary/22 border-primary/45 hover:bg-primary/30",
  image: "bg-info/22 border-info/45 hover:bg-info/30",
  video: "bg-brand-pink/22 border-brand-pink/45 hover:bg-brand-pink/30",
  shape: "bg-warning/22 border-warning/45 hover:bg-warning/30",
  icon: "bg-success/22 border-success/45 hover:bg-success/30",
  gradient: "bg-chart-5/22 border-chart-5/45 hover:bg-chart-5/30",
};

interface ClipGeometry {
  startTime: number;
  duration: number;
}

/** Shared drag/resize behaviour for both layer and audio clips. */
function useClipDrag({
  id,
  geometry,
  pixelsPerSecond,
  projectDuration,
  locked,
  onCommit,
  snapPoints,
}: {
  id: string;
  geometry: ClipGeometry;
  pixelsPerSecond: number;
  projectDuration: number;
  locked: boolean;
  onCommit: (timing: { startTime?: number; duration?: number }) => void;
  snapPoints: number[];
}) {
  const onPointerDown = React.useCallback(
    (event: React.PointerEvent, mode: DragMode) => {
      if (locked) return;
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const original = { ...geometry };
      const snapSeconds = SNAP_PX / pixelsPerSecond;
      const snapEnabled = useEditorStore.getState().snapEnabled;

      useEditorStore.getState().beginInteraction(null);

      const onMove = (moveEvent: PointerEvent) => {
        const deltaSeconds = (moveEvent.clientX - startX) / pixelsPerSecond;

        if (mode === "move") {
          let next = original.startTime + deltaSeconds;
          if (snapEnabled) next = snapValue(next, snapPoints, snapSeconds);
          onCommit({ startTime: Math.max(0, Math.min(next, projectDuration - original.duration)) });
          return;
        }

        if (mode === "resize-end") {
          let end = original.startTime + original.duration + deltaSeconds;
          if (snapEnabled) end = snapValue(end, snapPoints, snapSeconds);
          const duration = Math.max(0.1, Math.min(end - original.startTime, projectDuration - original.startTime));
          onCommit({ duration });
          return;
        }

        // resize-start: the right edge stays put, so duration absorbs the move.
        let start = original.startTime + deltaSeconds;
        if (snapEnabled) start = snapValue(start, snapPoints, snapSeconds);
        const end = original.startTime + original.duration;
        const clampedStart = Math.max(0, Math.min(start, end - 0.1));
        onCommit({ startTime: clampedStart, duration: end - clampedStart });
      };

      const onUp = () => {
        useEditorStore.getState().endInteraction();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [geometry, pixelsPerSecond, projectDuration, locked, onCommit, snapPoints, id],
  );

  return onPointerDown;
}

/** Snap candidates: project bounds, the playhead and every other clip's edges. */
function useSnapPoints(excludeId: string): number[] {
  const doc = useEditorStore((s) => s.document);
  const currentTime = useEditorStore((s) => s.currentTime);

  return React.useMemo(() => {
    if (!doc) return [0];
    const points = [0, doc.canvas.duration, currentTime];
    for (const layer of doc.layers) {
      if (layer.id === excludeId) continue;
      points.push(layer.startTime, layer.startTime + layer.duration);
    }
    for (const track of doc.audioTracks) {
      if (track.id === excludeId) continue;
      points.push(track.startTime, track.startTime + track.duration);
    }
    for (const scene of doc.scenes) {
      points.push(scene.startTime, scene.startTime + scene.duration);
    }
    return points;
  }, [doc, currentTime, excludeId]);
}

export function TimelineTrack({
  layer,
  pixelsPerSecond,
  projectDuration,
  height,
}: {
  layer: Layer;
  pixelsPerSecond: number;
  projectDuration: number;
  height: number;
}) {
  const selected = useEditorStore((s) => s.selectedLayerIds.includes(layer.id));
  const snapPoints = useSnapPoints(layer.id);

  const onCommit = React.useCallback(
    (timing: { startTime?: number; duration?: number }) =>
      useEditorStore.getState().setLayerTiming(layer.id, timing),
    [layer.id],
  );

  const onPointerDown = useClipDrag({
    id: layer.id,
    geometry: { startTime: layer.startTime, duration: layer.duration },
    pixelsPerSecond,
    projectDuration,
    locked: layer.locked,
    onCommit,
    snapPoints,
  });

  return (
    <div className="relative border-b border-border/40" style={{ height }}>
      <div
        data-timeline-clip
        role="button"
        tabIndex={0}
        aria-label={`${layer.name}, from ${layer.startTime.toFixed(1)}s for ${layer.duration.toFixed(1)}s`}
        onPointerDown={(event) => {
          useEditorStore.getState().selectLayer(layer.id, {
            additive: event.shiftKey || event.metaKey || event.ctrlKey,
          });
          onPointerDown(event, "move");
        }}
        onKeyDown={(event) => {
          // Keyboard nudging on the timeline, mirroring canvas arrow-nudge.
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const step = event.shiftKey ? 1 : 0.1;
            onCommit({ startTime: layer.startTime + (event.key === "ArrowLeft" ? -step : step) });
          }
        }}
        className={cn(
          "group absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md border transition-colors",
          layer.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
          TYPE_STYLES[layer.type],
          selected && "ring-2 ring-primary ring-offset-1 ring-offset-card",
          layer.hidden && "opacity-40",
        )}
        style={{
          left: layer.startTime * pixelsPerSecond,
          width: Math.max(8, layer.duration * pixelsPerSecond),
        }}
      >
        <span className="pointer-events-none truncate px-2 text-[10px] font-semibold text-foreground/85">
          {layer.name}
        </span>

        {layer.locked && (
          <Lock className="pointer-events-none absolute right-1.5 size-3 text-foreground/50" />
        )}

        {/* Entrance/exit markers: a thin cap showing where animation runs. */}
        {layer.animation.enter && layer.animation.enter.type !== "none" && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 bg-linear-to-r from-foreground/25 to-transparent"
            style={{ width: Math.min(layer.animation.enter.duration * pixelsPerSecond, 40) }}
          />
        )}
        {layer.animation.exit && layer.animation.exit.type !== "none" && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 bg-linear-to-l from-foreground/25 to-transparent"
            style={{ width: Math.min(layer.animation.exit.duration * pixelsPerSecond, 40) }}
          />
        )}

        {!layer.locked && (
          <>
            <ResizeHandle side="start" onPointerDown={(e) => onPointerDown(e, "resize-start")} />
            <ResizeHandle side="end" onPointerDown={(e) => onPointerDown(e, "resize-end")} />
          </>
        )}
      </div>
    </div>
  );
}

export function TimelineAudioTrack({
  track,
  pixelsPerSecond,
  projectDuration,
  height,
}: {
  track: AudioTrack;
  pixelsPerSecond: number;
  projectDuration: number;
  height: number;
}) {
  const selected = useEditorStore((s) => s.selectedAudioId === track.id);
  const snapPoints = useSnapPoints(track.id);

  const onCommit = React.useCallback(
    (timing: { startTime?: number; duration?: number }) =>
      useEditorStore.getState().setAudioTiming(track.id, timing),
    [track.id],
  );

  const onPointerDown = useClipDrag({
    id: track.id,
    geometry: { startTime: track.startTime, duration: track.duration },
    pixelsPerSecond,
    projectDuration,
    locked: track.locked,
    onCommit,
    snapPoints,
  });

  return (
    <div className="relative border-b border-border/40" style={{ height }}>
      <div
        data-timeline-clip
        role="button"
        tabIndex={0}
        aria-label={`${track.name} audio, from ${track.startTime.toFixed(1)}s for ${track.duration.toFixed(1)}s`}
        onPointerDown={(event) => {
          useEditorStore.getState().selectAudio(track.id);
          onPointerDown(event, "move");
        }}
        className={cn(
          "group absolute top-1 bottom-1 flex items-center gap-1.5 overflow-hidden rounded-md border border-chart-2/45 bg-chart-2/22 px-2 transition-colors hover:bg-chart-2/30",
          track.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
          selected && "ring-2 ring-primary ring-offset-1 ring-offset-card",
          track.muted && "opacity-45",
        )}
        style={{
          left: track.startTime * pixelsPerSecond,
          width: Math.max(8, track.duration * pixelsPerSecond),
        }}
      >
        {track.muted ? (
          <VolumeX className="pointer-events-none size-3 shrink-0 text-foreground/60" />
        ) : (
          <Music4 className="pointer-events-none size-3 shrink-0 text-foreground/60" />
        )}
        <span className="pointer-events-none truncate text-[10px] font-semibold text-foreground/85">
          {track.name}
        </span>

        {/* A static waveform silhouette — enough to read the clip as audio
            without decoding the file just to draw a decoration. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex h-2.5 items-end gap-px px-1 opacity-45">
          {WAVE_PATTERN.map((h, i) => (
            <span key={i} className="flex-1 rounded-t-[1px] bg-foreground/50" style={{ height: `${h}%` }} />
          ))}
        </span>

        {!track.locked && (
          <>
            <ResizeHandle side="start" onPointerDown={(e) => onPointerDown(e, "resize-start")} />
            <ResizeHandle side="end" onPointerDown={(e) => onPointerDown(e, "resize-end")} />
          </>
        )}
      </div>
    </div>
  );
}

/** Deterministic silhouette so clips don't shimmer between renders. */
const WAVE_PATTERN = [30, 55, 40, 75, 50, 90, 45, 65, 35, 80, 55, 42, 70, 48, 85, 38, 60, 44, 72, 52];

function ResizeHandle({
  side,
  onPointerDown,
}: {
  side: "start" | "end";
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  return (
    <span
      role="separator"
      aria-label={side === "start" ? "Adjust clip start" : "Adjust clip end"}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute inset-y-0 w-2 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100",
        "before:absolute before:inset-y-1 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:rounded-full before:bg-foreground/70",
        side === "start" ? "left-0" : "right-0",
      )}
    />
  );
}
