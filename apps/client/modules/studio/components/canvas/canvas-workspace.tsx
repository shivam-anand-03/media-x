"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useEditorStore } from "../../stores/editor-store";
import { InlineTextEditor } from "./inline-text-editor";

/**
 * The canvas viewport.
 *
 * Owns everything *around* the artboard: zoom-to-fit, panning, the checkered
 * void, and the inline text editor overlay. The Konva stage itself is loaded
 * lazily and client-only — Konva touches `window` at import time, so it must
 * never be part of the server bundle (§42, lazy-load heavy editor deps).
 */

const CanvasStage = dynamic(() => import("./canvas-stage").then((m) => m.CanvasStage), {
  ssr: false,
  loading: () => <ArtboardSkeleton />,
});

/** Padding between the artboard and the viewport edge, in screen pixels. */
const VIEWPORT_PADDING = 64;

export function CanvasWorkspace({ className }: { className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

  const doc = useEditorStore((s) => s.document);
  const zoom = useEditorStore((s) => s.zoom);
  const fitToScreen = useEditorStore((s) => s.fitToScreen);
  const setZoom = useEditorStore((s) => s.setZoom);

  // Track the viewport so "fit" stays correct when panels resize.
  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const canvas = doc?.canvas;

  const fitScale = React.useMemo(() => {
    if (!canvas || containerSize.width === 0 || containerSize.height === 0) return 1;
    return Math.min(
      (containerSize.width - VIEWPORT_PADDING) / canvas.width,
      (containerSize.height - VIEWPORT_PADDING) / canvas.height,
    );
  }, [canvas, containerSize]);

  const scale = fitToScreen ? Math.max(0.02, fitScale) : zoom;

  // Publish the effective scale so the toolbar's zoom readout matches reality
  // while "fit" is active.
  React.useEffect(() => {
    if (fitToScreen && Number.isFinite(fitScale) && fitScale > 0) {
      useEditorStore.setState({ zoom: fitScale });
    }
  }, [fitToScreen, fitScale]);

  // Ctrl/Cmd + wheel zooms, like every design tool. A plain wheel is left to
  // the browser so long canvases can still be scrolled.
  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const current = useEditorStore.getState().zoom;
      setZoom(current * (event.deltaY < 0 ? 1.08 : 0.926));
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden",
        // A subtle dot field reads as "void around the artboard" without the
        // noise of a full checkerboard.
        "bg-[radial-gradient(color-mix(in_oklab,var(--foreground)_9%,transparent)_1px,transparent_1px)] bg-size-[16px_16px]",
        className,
      )}
    >
      {!doc || !canvas ? (
        <ArtboardSkeleton />
      ) : (
        <div
          className="relative"
          style={{ width: canvas.width * scale, height: canvas.height * scale }}
        >
          {/* Artboard shadow + ring, drawn behind the stage. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-[2px] ring-1 ring-border/60 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)]"
          />
          <CanvasStage document={doc} scale={scale} />
          <InlineTextEditor scale={scale} />
        </div>
      )}
    </div>
  );
}

/** Shown while Konva loads, and before a project resolves (§38). */
function ArtboardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-[420px] w-[236px] animate-pulse rounded-sm bg-muted/60 ring-1 ring-border/60" />
      <p className="text-xs text-muted-foreground">Preparing canvas…</p>
    </div>
  );
}
