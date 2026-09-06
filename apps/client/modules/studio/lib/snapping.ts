import type { Layer } from "@workspace/motion";
import type { Guide } from "../stores/editor-store";

/**
 * Alignment guides and snapping (§15).
 *
 * Candidate lines are computed once per gesture (in canvas space, from the
 * layers that are *not* being dragged) and then matched against the moving
 * box on each pointer move. That keeps the per-move cost proportional to the
 * number of candidate lines rather than re-deriving every layer's geometry on
 * every mouse event (§42).
 */

/** Pointer distance, in screen pixels, within which a snap engages. */
const SNAP_THRESHOLD_SCREEN = 7;

export interface Bounds {
  /** Centre. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapCandidate {
  position: number;
  kind: Guide["kind"];
}

export interface SnapTargets {
  x: SnapCandidate[];
  y: SnapCandidate[];
}

/**
 * Builds the lines a dragged layer can snap to: canvas centre and edges, plus
 * the edges and centres of every other visible, unlocked layer.
 */
export function buildSnapTargets(
  layers: readonly Layer[],
  excludeIds: readonly string[],
  canvasWidth: number,
  canvasHeight: number,
): SnapTargets {
  const exclude = new Set(excludeIds);
  const x: SnapCandidate[] = [
    { position: canvasWidth / 2, kind: "center" },
    { position: 0, kind: "edge" },
    { position: canvasWidth, kind: "edge" },
  ];
  const y: SnapCandidate[] = [
    { position: canvasHeight / 2, kind: "center" },
    { position: 0, kind: "edge" },
    { position: canvasHeight, kind: "edge" },
  ];

  for (const layer of layers) {
    if (exclude.has(layer.id) || layer.hidden) continue;
    const t = layer.transform;
    const halfW = (t.width * Math.abs(t.scaleX)) / 2;
    const halfH = (t.height * Math.abs(t.scaleY)) / 2;

    x.push({ position: t.x, kind: "object" });
    x.push({ position: t.x - halfW, kind: "object" });
    x.push({ position: t.x + halfW, kind: "object" });
    y.push({ position: t.y, kind: "object" });
    y.push({ position: t.y - halfH, kind: "object" });
    y.push({ position: t.y + halfH, kind: "object" });
  }

  return { x, y };
}

export interface SnapResult {
  x: number;
  y: number;
  guides: Guide[];
}

/**
 * Snaps a moving box to the nearest candidate on each axis.
 *
 * The threshold is divided by `zoom` so snapping always feels like the same
 * distance under the cursor, whether the canvas is at 25% or 200%.
 */
export function snapBounds(bounds: Bounds, targets: SnapTargets, zoom: number): SnapResult {
  const threshold = SNAP_THRESHOLD_SCREEN / Math.max(zoom, 0.01);
  const halfW = bounds.width / 2;
  const halfH = bounds.height / 2;

  // For each axis, try snapping the box's start, centre and end, and keep the
  // closest match — that is what makes edges align, not just centres.
  const xSnap = bestSnap(
    [
      { value: bounds.x - halfW, offset: halfW },
      { value: bounds.x, offset: 0 },
      { value: bounds.x + halfW, offset: -halfW },
    ],
    targets.x,
    threshold,
  );

  const ySnap = bestSnap(
    [
      { value: bounds.y - halfH, offset: halfH },
      { value: bounds.y, offset: 0 },
      { value: bounds.y + halfH, offset: -halfH },
    ],
    targets.y,
    threshold,
  );

  const guides: Guide[] = [];
  if (xSnap) guides.push({ axis: "x", position: xSnap.line, kind: xSnap.kind });
  if (ySnap) guides.push({ axis: "y", position: ySnap.line, kind: ySnap.kind });

  return {
    x: xSnap ? xSnap.line + xSnap.offset : bounds.x,
    y: ySnap ? ySnap.line + ySnap.offset : bounds.y,
    guides,
  };
}

interface Probe {
  value: number;
  /** Added back to the snapped line to recover the centre coordinate. */
  offset: number;
}

function bestSnap(
  probes: Probe[],
  candidates: SnapCandidate[],
  threshold: number,
): { line: number; offset: number; kind: Guide["kind"]; distance: number } | null {
  let best: { line: number; offset: number; kind: Guide["kind"]; distance: number } | null = null;

  for (const probe of probes) {
    for (const candidate of candidates) {
      const distance = Math.abs(probe.value - candidate.position);
      if (distance > threshold) continue;
      // Prefer a closer line; on a tie, prefer the centre guide because that is
      // what a user is usually aiming for.
      if (
        !best ||
        distance < best.distance ||
        (distance === best.distance && candidate.kind === "center" && best.kind !== "center")
      ) {
        best = { line: candidate.position, offset: probe.offset, kind: candidate.kind, distance };
      }
    }
  }
  return best;
}

/** Snaps a single scalar (used by the timeline for clip edges). */
export function snapValue(value: number, candidates: readonly number[], threshold: number): number {
  let best = value;
  let bestDistance = threshold;
  for (const candidate of candidates) {
    const distance = Math.abs(value - candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}
