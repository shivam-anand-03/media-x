"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  addAudioTrack as addAudioTrackOp,
  addLayer as addLayerOp,
  cloneLayersForPaste,
  collectProjectColors,
  createId,
  duplicateLayers as duplicateLayersOp,
  nextZIndex,
  removeAudioTrack as removeAudioTrackOp,
  removeLayers as removeLayersOp,
  reorderLayers as reorderLayersOp,
  setAudioTiming as setAudioTimingOp,
  setLayerTiming as setLayerTimingOp,
  setProjectDuration as setProjectDurationOp,
  updateAudioTrack as updateAudioTrackOp,
  updateLayer as updateLayerOp,
  type AudioTrack,
  type Background,
  type Layer,
  type ProjectDocument,
  type ReorderDirection,
} from "@workspace/motion";

/**
 * The editor store — one source of truth for the canvas, timeline, layer panel
 * and inspector (§18, §51).
 *
 * Three rules make the rest of the editor simple:
 *
 *  1. Every document mutation goes through `commit`, which snapshots the
 *     previous document onto an undo stack. Undo is therefore never a refetch
 *     (§25) and every operation is undoable by construction.
 *  2. `document` is replaced, never mutated, so components can subscribe to
 *     exactly the slice they care about and a layer drag re-renders one layer
 *     rather than the whole canvas (§42).
 *  3. Transient state (playhead, selection, zoom, drag) lives beside the
 *     document but is *not* part of history — undoing an edit should not also
 *     rewind the playhead.
 */

const HISTORY_LIMIT = 100;

export type ToolId = "templates" | "text" | "media" | "elements" | "audio" | "background" | "uploads";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "offline";

export interface Guide {
  axis: "x" | "y";
  /** Canvas-space coordinate the guide sits on. */
  position: number;
  /** `center` guides render differently from edge/object matches. */
  kind: "center" | "edge" | "object";
}

interface HistoryEntry {
  document: ProjectDocument;
  /** Ids selected when the snapshot was taken, so undo restores focus too. */
  selection: string[];
}

export interface EditorState {
  // ---- Identity -----------------------------------------------------------
  projectId: string | null;
  projectName: string;
  /** Server revision this document is based on; sent with every save. */
  revision: number;

  // ---- Document (history-tracked) -----------------------------------------
  document: ProjectDocument | null;

  // ---- History ------------------------------------------------------------
  past: HistoryEntry[];
  future: HistoryEntry[];

  // ---- Selection ----------------------------------------------------------
  selectedLayerIds: string[];
  selectedAudioId: string | null;

  // ---- Playback -----------------------------------------------------------
  currentTime: number;
  isPlaying: boolean;
  loopPlayback: boolean;

  // ---- Viewport -----------------------------------------------------------
  zoom: number;
  /** `true` while zoom should track the container size. */
  fitToScreen: boolean;
  showSafeArea: boolean;
  showGuides: boolean;
  snapEnabled: boolean;

  // ---- Panels -------------------------------------------------------------
  activeTool: ToolId;
  leftPanelOpen: boolean;
  timelineHeight: number;
  timelineZoom: number;

  // ---- Transient editing state -------------------------------------------
  guides: Guide[];
  /** Set while a layer is mid-drag so the canvas can skip expensive work. */
  interactingLayerId: string | null;
  editingTextLayerId: string | null;
  clipboard: Layer[];
  /**
   * Audio tracks whose file could not be loaded (deleted asset, dead URL).
   * Transient and not part of history — it describes the world, not the
   * document. Without it a missing file is simply silence with no explanation.
   */
  unavailableAudioIds: string[];

  // ---- Persistence --------------------------------------------------------
  saveState: SaveState;
  lastSavedAt: number | null;
  saveError: string | null;
  /** Bumped whenever the document changes, so autosave can debounce on it. */
  dirtyCounter: number;
}

export interface EditorActions {
  loadProject(input: { id: string; name: string; document: ProjectDocument; revision: number }): void;
  resetEditor(): void;
  setProjectName(name: string): void;

  // Document mutations — all undoable.
  addLayer(layer: Layer, options?: { select?: boolean }): void;
  addLayers(layers: Layer[], options?: { select?: boolean }): void;
  updateLayer(id: string, patch: (layer: Layer) => Layer, options?: { transient?: boolean }): void;
  patchLayerTransform(id: string, transform: Partial<Layer["transform"]>, options?: { transient?: boolean }): void;
  removeSelectedLayers(): void;
  removeLayer(id: string): void;
  duplicateSelectedLayers(): void;
  reorderSelectedLayers(direction: ReorderDirection): void;
  setLayerTiming(id: string, timing: { startTime?: number; duration?: number }): void;
  renameLayer(id: string, name: string): void;
  toggleLayerVisibility(id: string): void;
  toggleLayerLock(id: string): void;
  nudgeSelection(dx: number, dy: number): void;

  setBackground(background: Background): void;
  setCanvasDuration(duration: number): void;
  setCanvasFps(fps: ProjectDocument["canvas"]["fps"]): void;

  addAudioTrack(track: AudioTrack): void;
  updateAudioTrack(id: string, patch: Partial<AudioTrack>): void;
  removeAudioTrack(id: string): void;
  setAudioTiming(id: string, timing: { startTime?: number; duration?: number; trimStart?: number }): void;

  replaceDocument(document: ProjectDocument, options?: { resetHistory?: boolean }): void;

  // History
  undo(): void;
  redo(): void;
  /** Groups a burst of transient updates (a drag) into one history entry. */
  beginInteraction(layerId: string | null): void;
  endInteraction(): void;

  // Selection
  selectLayer(id: string | null, options?: { additive?: boolean }): void;
  selectLayers(ids: string[]): void;
  selectAll(): void;
  clearSelection(): void;
  selectAudio(id: string | null): void;

  // Clipboard
  copySelection(): void;
  cutSelection(): void;
  paste(): void;

  // Playback
  play(): void;
  pause(): void;
  togglePlay(): void;
  setCurrentTime(time: number): void;
  setLoopPlayback(loop: boolean): void;

  // Viewport / panels
  setZoom(zoom: number): void;
  setFitToScreen(fit: boolean): void;
  toggleSafeArea(): void;
  toggleSnap(): void;
  setActiveTool(tool: ToolId): void;
  setLeftPanelOpen(open: boolean): void;
  setTimelineHeight(height: number): void;
  setTimelineZoom(zoom: number): void;
  setGuides(guides: Guide[]): void;
  setEditingTextLayer(id: string | null): void;
  markAudioUnavailable(id: string, unavailable: boolean): void;

  // Persistence
  setSaveState(state: SaveState, error?: string | null): void;
  markSaved(revision: number): void;
}

export type EditorStore = EditorState & EditorActions;

const initialState: EditorState = {
  projectId: null,
  projectName: "Untitled Advertisement",
  revision: 0,
  document: null,
  past: [],
  future: [],
  selectedLayerIds: [],
  selectedAudioId: null,
  currentTime: 0,
  isPlaying: false,
  loopPlayback: true,
  zoom: 1,
  fitToScreen: true,
  showSafeArea: false,
  showGuides: true,
  snapEnabled: true,
  activeTool: "templates",
  leftPanelOpen: true,
  timelineHeight: 264,
  timelineZoom: 1,
  guides: [],
  interactingLayerId: null,
  editingTextLayerId: null,
  clipboard: [],
  unavailableAudioIds: [],
  saveState: "idle",
  lastSavedAt: null,
  saveError: null,
  dirtyCounter: 0,
};

export const useEditorStore = create<EditorStore>()(
  subscribeWithSelector((set, get) => {
    /**
     * Applies a document transform and records history.
     *
     * `transient` skips the history push — used for the intermediate frames of
     * a drag, where one entry per mouse-move would make undo useless. The
     * single entry for the whole gesture is pushed by `beginInteraction`.
     */
    const commit = (
      mutate: (doc: ProjectDocument) => ProjectDocument,
      options?: { transient?: boolean; selection?: string[] },
    ) => {
      const state = get();
      const current = state.document;
      if (!current) return;

      const next = mutate(current);
      if (next === current) return; // No-op: don't dirty the project.

      set({
        document: next,
        past: options?.transient
          ? state.past
          : [...state.past, { document: current, selection: state.selectedLayerIds }].slice(-HISTORY_LIMIT),
        // Any new edit invalidates the redo branch.
        future: options?.transient ? state.future : [],
        ...(options?.selection ? { selectedLayerIds: options.selection } : {}),
        saveState: "dirty",
        dirtyCounter: state.dirtyCounter + 1,
      });
    };

    return {
      ...initialState,

      // ---------------------------------------------------------------- load
      loadProject: ({ id, name, document, revision }) =>
        set({
          ...initialState,
          projectId: id,
          projectName: name,
          document,
          revision,
          saveState: "saved",
          lastSavedAt: Date.now(),
        }),

      resetEditor: () => set({ ...initialState }),

      setProjectName: (name) =>
        set((s) => ({
          projectName: name,
          saveState: "dirty",
          dirtyCounter: s.dirtyCounter + 1,
        })),

      // ------------------------------------------------------------- layers
      addLayer: (layer, options) =>
        commit((doc) => addLayerOp(doc, layer), {
          selection: options?.select === false ? undefined : [layer.id],
        }),

      addLayers: (layers, options) =>
        commit(
          (doc) => layers.reduce((acc, layer) => addLayerOp(acc, layer), doc),
          { selection: options?.select === false ? undefined : layers.map((l) => l.id) },
        ),

      updateLayer: (id, patch, options) =>
        commit((doc) => updateLayerOp(doc, id, patch), { transient: options?.transient }),

      patchLayerTransform: (id, transform, options) =>
        commit(
          (doc) =>
            updateLayerOp(doc, id, (layer) => ({
              ...layer,
              transform: { ...layer.transform, ...transform },
            })),
          { transient: options?.transient },
        ),

      removeLayer: (id) =>
        commit((doc) => removeLayersOp(doc, [id]), { selection: [] }),

      removeSelectedLayers: () => {
        const { selectedLayerIds, document } = get();
        if (!document || selectedLayerIds.length === 0) return;
        // Locked layers are protected from a stray Delete press.
        const deletable = document.layers
          .filter((l) => selectedLayerIds.includes(l.id) && !l.locked)
          .map((l) => l.id);
        if (deletable.length === 0) return;
        commit((doc) => removeLayersOp(doc, deletable), { selection: [] });
      },

      duplicateSelectedLayers: () => {
        const { selectedLayerIds } = get();
        if (selectedLayerIds.length === 0) return;
        let created: string[] = [];
        commit((doc) => {
          const { document: next, newIds } = duplicateLayersOp(doc, selectedLayerIds);
          created = newIds;
          return next;
        });
        if (created.length) set({ selectedLayerIds: created });
      },

      reorderSelectedLayers: (direction) => {
        const { selectedLayerIds } = get();
        if (selectedLayerIds.length === 0) return;
        commit((doc) => ({ ...doc, layers: reorderLayersOp(doc.layers, selectedLayerIds, direction) }));
      },

      setLayerTiming: (id, timing) => commit((doc) => setLayerTimingOp(doc, id, timing)),

      renameLayer: (id, name) =>
        commit((doc) => updateLayerOp(doc, id, (layer) => ({ ...layer, name: name.slice(0, 120) || layer.name }))),

      toggleLayerVisibility: (id) =>
        commit((doc) => updateLayerOp(doc, id, (layer) => ({ ...layer, hidden: !layer.hidden }))),

      toggleLayerLock: (id) =>
        commit((doc) => updateLayerOp(doc, id, (layer) => ({ ...layer, locked: !layer.locked }))),

      nudgeSelection: (dx, dy) => {
        const { selectedLayerIds, document } = get();
        if (!document || selectedLayerIds.length === 0) return;
        const movable = new Set(
          document.layers.filter((l) => selectedLayerIds.includes(l.id) && !l.locked).map((l) => l.id),
        );
        if (movable.size === 0) return;

        commit((doc) => ({
          ...doc,
          layers: doc.layers.map((layer) =>
            movable.has(layer.id)
              ? { ...layer, transform: { ...layer.transform, x: layer.transform.x + dx, y: layer.transform.y + dy } }
              : layer,
          ),
        }));
      },

      // --------------------------------------------------------- background
      setBackground: (background) => commit((doc) => ({ ...doc, background })),

      setCanvasDuration: (duration) => commit((doc) => setProjectDurationOp(doc, duration)),

      setCanvasFps: (fps) => commit((doc) => ({ ...doc, canvas: { ...doc.canvas, fps } })),

      // -------------------------------------------------------------- audio
      addAudioTrack: (track) => commit((doc) => addAudioTrackOp(doc, track)),
      updateAudioTrack: (id, patch) => commit((doc) => updateAudioTrackOp(doc, id, patch)),
      removeAudioTrack: (id) => {
        commit((doc) => removeAudioTrackOp(doc, id));
        if (get().selectedAudioId === id) set({ selectedAudioId: null });
      },
      setAudioTiming: (id, timing) => commit((doc) => setAudioTimingOp(doc, id, timing)),

      replaceDocument: (document, options) =>
        set((state) => ({
          document,
          past: options?.resetHistory
            ? []
            : state.document
              ? [...state.past, { document: state.document, selection: state.selectedLayerIds }].slice(-HISTORY_LIMIT)
              : state.past,
          future: [],
          selectedLayerIds: [],
          selectedAudioId: null,
          saveState: "dirty",
          dirtyCounter: state.dirtyCounter + 1,
        })),

      // ------------------------------------------------------------ history
      undo: () => {
        const state = get();
        const previous = state.past[state.past.length - 1];
        if (!previous || !state.document) return;
        set({
          document: previous.document,
          past: state.past.slice(0, -1),
          future: [{ document: state.document, selection: state.selectedLayerIds }, ...state.future].slice(0, HISTORY_LIMIT),
          // Restore what was selected when the snapshot was taken, filtered to
          // ids that still exist in the restored document.
          selectedLayerIds: previous.selection.filter((id) => previous.document.layers.some((l) => l.id === id)),
          saveState: "dirty",
          dirtyCounter: state.dirtyCounter + 1,
        });
      },

      redo: () => {
        const state = get();
        const next = state.future[0];
        if (!next || !state.document) return;
        set({
          document: next.document,
          past: [...state.past, { document: state.document, selection: state.selectedLayerIds }].slice(-HISTORY_LIMIT),
          future: state.future.slice(1),
          selectedLayerIds: next.selection.filter((id) => next.document.layers.some((l) => l.id === id)),
          saveState: "dirty",
          dirtyCounter: state.dirtyCounter + 1,
        });
      },

      /**
       * Opens a gesture. Pushes exactly one history entry up-front; every
       * update during the drag is then `transient`, so undo rewinds the whole
       * gesture in one step instead of pixel by pixel.
       */
      beginInteraction: (layerId) => {
        const state = get();
        if (!state.document) return;
        set({
          interactingLayerId: layerId,
          past: [...state.past, { document: state.document, selection: state.selectedLayerIds }].slice(-HISTORY_LIMIT),
          future: [],
        });
      },

      endInteraction: () => set({ interactingLayerId: null, guides: [] }),

      // ---------------------------------------------------------- selection
      selectLayer: (id, options) => {
        if (id === null) {
          set({ selectedLayerIds: [], selectedAudioId: null, editingTextLayerId: null });
          return;
        }
        set((state) => {
          if (!options?.additive) {
            return { selectedLayerIds: [id], selectedAudioId: null, editingTextLayerId: null };
          }
          const has = state.selectedLayerIds.includes(id);
          return {
            selectedLayerIds: has
              ? state.selectedLayerIds.filter((x) => x !== id)
              : [...state.selectedLayerIds, id],
            selectedAudioId: null,
            editingTextLayerId: null,
          };
        });
      },

      selectLayers: (ids) => set({ selectedLayerIds: ids, selectedAudioId: null }),

      selectAll: () =>
        set((state) => ({
          selectedLayerIds: (state.document?.layers ?? []).filter((l) => !l.locked).map((l) => l.id),
          selectedAudioId: null,
        })),

      clearSelection: () => set({ selectedLayerIds: [], selectedAudioId: null, editingTextLayerId: null }),

      selectAudio: (id) => set({ selectedAudioId: id, selectedLayerIds: [] }),

      // ---------------------------------------------------------- clipboard
      copySelection: () => {
        const { document, selectedLayerIds } = get();
        if (!document) return;
        const layers = document.layers.filter((l) => selectedLayerIds.includes(l.id));
        if (layers.length) set({ clipboard: layers });
      },

      cutSelection: () => {
        get().copySelection();
        get().removeSelectedLayers();
      },

      paste: () => {
        const { clipboard, document } = get();
        if (!document || clipboard.length === 0) return;
        const copies = cloneLayersForPaste(clipboard, nextZIndex(document.layers));
        commit((doc) => copies.reduce((acc, layer) => addLayerOp(acc, layer), doc), {
          selection: copies.map((l) => l.id),
        });
      },

      // ----------------------------------------------------------- playback
      play: () => {
        const { document, currentTime } = get();
        if (!document) return;
        // Restarting from the end is what a user expects from a play button
        // that was left at the end of the timeline.
        const atEnd = currentTime >= document.canvas.duration - 0.02;
        set({ isPlaying: true, currentTime: atEnd ? 0 : currentTime, editingTextLayerId: null });
      },
      pause: () => set({ isPlaying: false }),
      togglePlay: () => (get().isPlaying ? get().pause() : get().play()),
      setCurrentTime: (time) => {
        const duration = get().document?.canvas.duration ?? 0;
        set({ currentTime: Math.max(0, Math.min(time, duration)) });
      },
      setLoopPlayback: (loop) => set({ loopPlayback: loop }),

      // ----------------------------------------------------------- viewport
      setZoom: (zoom) => set({ zoom: Math.max(0.05, Math.min(zoom, 4)), fitToScreen: false }),
      setFitToScreen: (fit) => set({ fitToScreen: fit }),
      toggleSafeArea: () => set((s) => ({ showSafeArea: !s.showSafeArea })),
      toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
      setActiveTool: (tool) => set({ activeTool: tool, leftPanelOpen: true }),
      setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
      setTimelineHeight: (height) => set({ timelineHeight: Math.max(160, Math.min(height, 560)) }),
      setTimelineZoom: (zoom) => set({ timelineZoom: Math.max(0.25, Math.min(zoom, 8)) }),
      setGuides: (guides) => set({ guides }),
      setEditingTextLayer: (id) => set({ editingTextLayerId: id }),

      markAudioUnavailable: (id, unavailable) =>
        set((state) => {
          const has = state.unavailableAudioIds.includes(id);
          if (has === unavailable) return state;
          return {
            unavailableAudioIds: unavailable
              ? [...state.unavailableAudioIds, id]
              : state.unavailableAudioIds.filter((x) => x !== id),
          };
        }),

      // -------------------------------------------------------- persistence
      setSaveState: (state, error) => set({ saveState: state, saveError: error ?? null }),
      markSaved: (revision) =>
        set({ saveState: "saved", lastSavedAt: Date.now(), saveError: null, revision }),
    };
  }),
);

// ---------------------------------------------------------------------------
// Selectors
//
// Components subscribe through these rather than reading the whole store, so a
// layer drag re-renders the layer and the inspector — not the timeline, the
// tool panel and every other layer (§42).
// ---------------------------------------------------------------------------

export const selectDocument = (s: EditorStore) => s.document;
export const selectCanvas = (s: EditorStore) => s.document?.canvas;
export const selectLayers = (s: EditorStore) => s.document?.layers;
export const selectAudioTracks = (s: EditorStore) => s.document?.audioTracks;
export const selectScenes = (s: EditorStore) => s.document?.scenes;
export const selectCurrentTime = (s: EditorStore) => s.currentTime;
export const selectIsPlaying = (s: EditorStore) => s.isPlaying;
export const selectSelectedIds = (s: EditorStore) => s.selectedLayerIds;
export const selectCanUndo = (s: EditorStore) => s.past.length > 0;
export const selectCanRedo = (s: EditorStore) => s.future.length > 0;

/** The single selected layer, or null when zero or many are selected. */
export const selectSingleSelectedLayer = (s: EditorStore): Layer | null => {
  if (s.selectedLayerIds.length !== 1 || !s.document) return null;
  return s.document.layers.find((l) => l.id === s.selectedLayerIds[0]) ?? null;
};

/**
 * Colours in use across the project.
 *
 * Must be a hook rather than a plain selector: `collectProjectColors` builds a
 * new array each call, and Zustand compares snapshots by reference — returning
 * a fresh array from a selector makes `useSyncExternalStore` re-render forever.
 * Selecting the (stable) document and memoising the derivation fixes that.
 */
export function useProjectColors(): string[] {
  const document = useEditorStore((s) => s.document);
  return useMemo(() => (document ? collectProjectColors(document) : []), [document]);
}

/** Stable factory for subscribing to exactly one layer. */
export const makeLayerSelector = (id: string) => (s: EditorStore) =>
  s.document?.layers.find((l) => l.id === id) ?? null;
