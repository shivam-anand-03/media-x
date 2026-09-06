import type { AudioTrack, Layer, ProjectDocument } from "./schema.js";

/**
 * Pure operations over a project document.
 *
 * The editor store is a thin wrapper around these: every mutation is
 * `document -> document`, which is what makes undo/redo a plain snapshot stack
 * rather than a pile of inverse operations. It also makes the interesting
 * behaviour (z-ordering, timing clamps, duplication offsets) unit-testable
 * without mounting React.
 */

export const clampNumber = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/** Rounds to 3dp — enough precision for sub-frame timing, and it stops float
 *  drift from making autosave think the document changed. */
export const round3 = (v: number): number => Math.round(v * 1000) / 1000;

let idCounter = 0;

/**
 * Deterministic-ish unique id. `crypto.randomUUID` when available (browser and
 * Node ≥19), with a counter fallback so the module stays usable in any runtime.
 */
export function createId(prefix = "ly"): string {
  const cryptoRef = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") {
    return `${prefix}_${cryptoRef.randomUUID().split("-")[0]}${cryptoRef.randomUUID().split("-")[1]}`;
  }
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/** Layers back-to-front. Ties break on id so the order is stable across renders. */
export function sortByZIndex(layers: readonly Layer[]): Layer[] {
  return [...layers].sort((a, b) => (a.zIndex === b.zIndex ? a.id.localeCompare(b.id) : a.zIndex - b.zIndex));
}

/** Collapses z-indices to a dense 0..n-1 range, preserving relative order. */
export function normalizeZIndices(layers: readonly Layer[]): Layer[] {
  return sortByZIndex(layers).map((layer, index) => (layer.zIndex === index ? layer : { ...layer, zIndex: index }));
}

export function nextZIndex(layers: readonly Layer[]): number {
  return layers.reduce((max, l) => Math.max(max, l.zIndex), -1) + 1;
}

export type ReorderDirection = "front" | "back" | "forward" | "backward";

/**
 * Moves the given layers in the stack. Operates on the dense ordering so
 * "bring forward" always moves exactly one step regardless of prior gaps.
 */
export function reorderLayers(
  layers: readonly Layer[],
  ids: readonly string[],
  direction: ReorderDirection,
): Layer[] {
  const ordered = normalizeZIndices(layers);
  const idSet = new Set(ids);
  const selected = ordered.filter((l) => idSet.has(l.id));
  if (selected.length === 0) return ordered;

  const rest = ordered.filter((l) => !idSet.has(l.id));

  if (direction === "front") return renumber([...rest, ...selected]);
  if (direction === "back") return renumber([...selected, ...rest]);

  // Step moves shift each selected layer one slot, walking from the edge that
  // the move heads toward so a multi-selection keeps its internal order.
  const next = [...ordered];
  const indices = ordered.flatMap((l, i) => (idSet.has(l.id) ? [i] : []));
  const walk = direction === "forward" ? [...indices].reverse() : indices;

  for (const index of walk) {
    const target = direction === "forward" ? index + 1 : index - 1;
    if (target < 0 || target >= next.length) continue;
    const a = next[index];
    const b = next[target];
    // Don't swap past another selected layer — the group moves as a block.
    if (!a || !b || idSet.has(b.id)) continue;
    next[index] = b;
    next[target] = a;
  }
  return renumber(next);
}

function renumber(layers: readonly Layer[]): Layer[] {
  return layers.map((layer, index) => (layer.zIndex === index ? layer : { ...layer, zIndex: index }));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function addLayer(doc: ProjectDocument, layer: Layer): ProjectDocument {
  return { ...doc, layers: normalizeZIndices([...doc.layers, layer]) };
}

export function removeLayers(doc: ProjectDocument, ids: readonly string[]): ProjectDocument {
  const idSet = new Set(ids);
  const remaining = doc.layers.filter((l) => !idSet.has(l.id));
  if (remaining.length === doc.layers.length) return doc;
  return { ...doc, layers: normalizeZIndices(remaining) };
}

export function updateLayer(
  doc: ProjectDocument,
  id: string,
  patch: (layer: Layer) => Layer,
): ProjectDocument {
  let changed = false;
  const layers = doc.layers.map((layer) => {
    if (layer.id !== id) return layer;
    changed = true;
    return patch(layer);
  });
  return changed ? { ...doc, layers } : doc;
}

/** Duplicates layers, offsetting each copy so it is visibly distinct. */
export function duplicateLayers(
  doc: ProjectDocument,
  ids: readonly string[],
  offset = 32,
): { document: ProjectDocument; newIds: string[] } {
  const idSet = new Set(ids);
  const source = sortByZIndex(doc.layers).filter((l) => idSet.has(l.id));
  if (source.length === 0) return { document: doc, newIds: [] };

  let z = nextZIndex(doc.layers);
  const newIds: string[] = [];
  const copies = source.map((layer) => {
    const id = createId(layer.type);
    newIds.push(id);
    z += 1;
    return {
      ...layer,
      id,
      name: `${layer.name} copy`,
      zIndex: z,
      transform: { ...layer.transform, x: layer.transform.x + offset, y: layer.transform.y + offset },
    } as Layer;
  });

  return {
    document: { ...doc, layers: normalizeZIndices([...doc.layers, ...copies]) },
    newIds,
  };
}

/** Clones layers for the clipboard, giving them fresh ids at paste time. */
export function cloneLayersForPaste(layers: readonly Layer[], zStart: number, offset = 40): Layer[] {
  return layers.map((layer, i) => ({
    ...layer,
    id: createId(layer.type),
    name: `${layer.name} copy`,
    zIndex: zStart + i,
    transform: { ...layer.transform, x: layer.transform.x + offset, y: layer.transform.y + offset },
  }));
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/**
 * Moves a layer along the timeline. `startTime` is clamped to the project so a
 * clip can never be dragged off either end — dragging past the end would make
 * it silently absent from the export.
 */
export function setLayerTiming(
  doc: ProjectDocument,
  id: string,
  timing: { startTime?: number; duration?: number },
): ProjectDocument {
  const total = doc.canvas.duration;
  return updateLayer(doc, id, (layer) => {
    const duration = clampNumber(round3(timing.duration ?? layer.duration), 0.1, total);
    const startTime = clampNumber(round3(timing.startTime ?? layer.startTime), 0, Math.max(0, total - duration));
    if (startTime === layer.startTime && duration === layer.duration) return layer;
    return { ...layer, startTime, duration };
  });
}

export function setAudioTiming(
  doc: ProjectDocument,
  id: string,
  timing: { startTime?: number; duration?: number; trimStart?: number },
): ProjectDocument {
  const total = doc.canvas.duration;
  let changed = false;
  const audioTracks = doc.audioTracks.map((track) => {
    if (track.id !== id) return track;
    const duration = clampNumber(round3(timing.duration ?? track.duration), 0.1, total);
    const startTime = clampNumber(round3(timing.startTime ?? track.startTime), 0, Math.max(0, total - duration));
    const trimStart = clampNumber(round3(timing.trimStart ?? track.trimStart), 0, 3600);
    if (startTime === track.startTime && duration === track.duration && trimStart === track.trimStart) return track;
    changed = true;
    return { ...track, startTime, duration, trimStart };
  });
  return changed ? { ...doc, audioTracks } : doc;
}

/**
 * Re-clamps everything to a new project duration. Called when the user changes
 * the canvas length so no clip is left dangling beyond the end of the video.
 */
export function setProjectDuration(doc: ProjectDocument, duration: number): ProjectDocument {
  const total = clampNumber(round3(duration), 0.5, 300);
  const fit = <T extends { startTime: number; duration: number }>(item: T): T => {
    const d = Math.min(item.duration, total);
    const s = clampNumber(item.startTime, 0, Math.max(0, total - d));
    return d === item.duration && s === item.startTime ? item : { ...item, startTime: s, duration: d };
  };
  return {
    ...doc,
    canvas: { ...doc.canvas, duration: total },
    layers: doc.layers.map(fit),
    audioTracks: doc.audioTracks.map(fit),
    scenes: doc.scenes.map(fit),
  };
}

/** True when the playhead falls inside the layer's span. */
export function isLayerActiveAt(layer: Pick<Layer, "startTime" | "duration">, time: number): boolean {
  return time >= layer.startTime && time < layer.startTime + layer.duration;
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export function addAudioTrack(doc: ProjectDocument, track: AudioTrack): ProjectDocument {
  return { ...doc, audioTracks: [...doc.audioTracks, track] };
}

export function removeAudioTrack(doc: ProjectDocument, id: string): ProjectDocument {
  const audioTracks = doc.audioTracks.filter((t) => t.id !== id);
  return audioTracks.length === doc.audioTracks.length ? doc : { ...doc, audioTracks };
}

export function updateAudioTrack(
  doc: ProjectDocument,
  id: string,
  patch: Partial<AudioTrack>,
): ProjectDocument {
  let changed = false;
  const audioTracks = doc.audioTracks.map((track) => {
    if (track.id !== id) return track;
    changed = true;
    return { ...track, ...patch };
  });
  return changed ? { ...doc, audioTracks } : doc;
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Colours actually in use, so the picker can offer them as project colours. */
export function collectProjectColors(doc: ProjectDocument): string[] {
  const colors = new Set<string>();
  const push = (c?: string) => {
    if (c) colors.add(c.toLowerCase());
  };

  if (doc.background.type === "solid") push(doc.background.value);
  if (doc.background.type === "gradient") {
    push(doc.background.from);
    push(doc.background.to);
  }

  for (const layer of doc.layers) {
    switch (layer.type) {
      case "text":
        push(layer.properties.color);
        push(layer.properties.backgroundColor);
        break;
      case "shape":
        push(layer.properties.fill);
        push(layer.properties.stroke);
        break;
      case "icon":
        push(layer.properties.color);
        break;
      case "gradient":
        push(layer.properties.from);
        push(layer.properties.to);
        break;
      default:
        break;
    }
  }
  return [...colors].slice(0, 24);
}

/** Total frames the renderer must produce. */
export function totalFrames(doc: ProjectDocument): number {
  return Math.max(1, Math.round(doc.canvas.duration * doc.canvas.fps));
}

/** `0:07` / `1:02` style stamp for timeline rulers and project cards. */
export function formatTimecode(seconds: number, showFrames = false, fps = 30): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const stamp = `${mins}:${secs.toString().padStart(2, "0")}`;
  if (!showFrames) return stamp;
  const frames = Math.floor((safe % 1) * fps);
  return `${stamp}.${frames.toString().padStart(2, "0")}`;
}
