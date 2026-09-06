# The editor

[← Back to README](../README.md)

Source: [`apps/client/modules/studio/`](../apps/client/modules/studio/)

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← │ Project name │ Saved │ undo redo │ zoom │ Preview │ Export   │
├────┬──────────────┬──────────────────────────┬───────────────────┤
│    │              │                          │  Inspector        │
│ T  │  Tool panel  │        Canvas            │  (contextual)     │
│ o  │              │        (Konva)           │                   │
│ o  │  Templates   │                          ├───────────────────┤
│ l  │  Text        │                          │  Layers           │
│    │  Media …     │                          │                   │
├────┴──────────────┴──────────────────────────┴───────────────────┤
│  Transport  ·  Ruler  ·  Tracks  ·  Playhead                     │
└──────────────────────────────────────────────────────────────────┘
```

Four panels, four questions — kept in sync because they all read one store:

| Panel | Answers |
|---|---|
| Canvas | *What does it look like?* |
| Timeline | *When does it appear?* |
| Inspector | *How does it behave?* |
| Layers | *What exists?* |

Panels are resizable (`react-resizable-panels` v4) and sizes persist per browser.

---

## The store

[`stores/editor-store.ts`](../apps/client/modules/studio/stores/editor-store.ts)

Three rules make everything else simple:

1. **Every document mutation goes through `commit()`**, which snapshots the previous
   document onto an undo stack. Undo is therefore never a refetch, and every
   operation is undoable *by construction* — a new action cannot forget to be.
2. **`document` is replaced, never mutated**, so components subscribe to exactly the
   slice they care about.
3. **Transient state lives beside the document but outside history.** Undoing an edit
   should not also rewind the playhead or the zoom level.

```ts
{
  // history-tracked
  document, past[], future[]

  // transient
  selectedLayerIds, selectedAudioId, currentTime, isPlaying,
  zoom, fitToScreen, activeTool, guides, editingTextLayerId,
  clipboard, unavailableAudioIds

  // persistence
  saveState, lastSavedAt, saveError, dirtyCounter, revision
}
```

### Selectors

Components read through selectors so a layer drag re-renders that layer and the
inspector — not the timeline and every other layer.

```ts
useEditorStore((s) => s.currentTime)
useEditorStore(selectSingleSelectedLayer)
useProjectColors()          // a hook, not a selector — see below
```

> **A trap worth knowing.** A selector that *builds* a value returns a new reference
> every call, and Zustand compares snapshots by reference — so it re-renders
> forever. `useProjectColors` is a hook that selects the (stable) document and
> memoises the derivation. Any selector returning a fresh array or object needs the
> same treatment.

---

## Undo / redo

`Ctrl/⌘ Z` · `Ctrl/⌘ Shift Z` · `Ctrl/⌘ Y`

- History caps at 100 entries.
- Undo restores the **selection** that was active when the snapshot was taken,
  filtered to ids that still exist.
- A new edit clears the redo branch.
- A drag is **one** entry, not one per pixel:

```ts
store.beginInteraction(layerId);              // pushes one snapshot
// … many patchLayerTransform(…, { transient: true })
store.endInteraction();
```

Everything is covered: add, delete, duplicate, move, resize, text, colour,
animation, timing, reorder, paste, background, canvas duration.

---

## Autosave

[`hooks/use-autosave.ts`](../apps/client/modules/studio/hooks/use-autosave.ts)

```
edit → Zustand (sync) → dirtyCounter++ → debounce 1.2s → PATCH → Mongo
```

- Debounced **1.2 s**, force-flushed after **8 s** of continuous editing, so a long
  streak still persists.
- Watches a single integer, so it never diffs documents.
- Edits landing mid-request leave the project dirty and reschedule — the counter is
  captured before the await.
- Flushes on tab hide and before unload; warns on unsaved close.
- Offline is a *state*, not an error: the indicator says so and the save is retried
  when the connection returns.

Indicator states: `Saved` · `Saving…` · `Unsaved changes` · `Offline — changes kept
locally` · `Unable to save [Retry]`. No toast — autosave fires constantly and a
notification per save would be unusable.

---

## Canvas

[`components/canvas/`](../apps/client/modules/studio/components/canvas/)

Konva, loaded lazily and client-only (it touches `window` at import).

- Drag, resize, rotate via `Transformer`; multi-select with Shift/⌘-click
- Snapping to canvas centre, canvas edges, and other layers' edges and centres
- Alignment guides drawn at hairline width regardless of zoom
- Safe-area overlay, zoom 25–400% or fit, `Ctrl`+wheel to zoom
- Double-click text to edit inline in a real `<textarea>` styled with the layer's own
  typography

**Resize is baked back into width/height.** Konva expresses a resize as a node scale;
leaving it there would mean a resized layer carries a permanent factor that compounds
with animation scale. On transform end the scale is folded into `width`/`height` and
the node reset to 1 (a flip is preserved as a negative scale).

**Canvas chrome follows the theme.** Konva paints to a `<canvas>` and cannot read CSS
variables, so handles and guides would normally hardcode a hex value and drift on a
retheme. `useCanvasThemeColors` resolves the tokens at runtime and re-reads them when
the light/dark class flips.

---

## Timeline

[`components/timeline/`](../apps/client/modules/studio/components/timeline/)

The authoritative view of *when*. Every clip's position and width is derived from
`startTime`/`duration`; dragging one writes straight back to the document. There is
no separate timeline state to fall out of sync.

- Drag the body to move; drag either edge to retime with the opposite edge pinned
- Snaps to the playhead, project bounds, scene boundaries and other clips
- Clips are clamped to the project, so one can never be dragged out of the export
- Entrance/exit markers show where animation runs
- Ruler tick spacing adapts to zoom so labels never collide
- Dedicated audio tracks with a waveform silhouette; a missing file turns the clip
  red and reads *"file unavailable"*

The whole gesture is one undo step.

---

## Inspector

Strictly contextual — a text layer never shows image filters.

| Selection | Shows |
|---|---|
| Nothing | Project: canvas, duration, frame rate, background, stats |
| One layer | Content, type-specific properties, transform, timing, animation, appearance |
| Several | Selection summary and arrange actions only |
| Audio clip | Timing, trim, volume, fades, mute, replace file, remove |

**Number fields scrub.** Drag the label to adjust — the standard design-tool
affordance. They keep a draft string so you can clear the box and retype without the
value snapping to 0 mid-edit.

**Animation preview** drives the real playhead across the layer's own span, so it is
the actual animation rather than a canned demo.

---

## Colour picker

HSV square, hue and alpha rails, HEX/RGB/HSL readouts, and three palettes: colours
already used in this project, your recent picks (localStorage), and presets.

The presets stay a full spectrum on purpose — you are designing advertisements, and
restricting them to the app's own theme would be a downgrade.

---

## Keyboard shortcuts

| | |
|---|---|
| `Del` / `Backspace` | Delete selection |
| `Ctrl/⌘ Z` · `Shift Z` · `Y` | Undo · Redo |
| `Ctrl/⌘ C` · `X` · `V` · `D` | Copy · Cut · Paste · Duplicate |
| `Ctrl/⌘ A` · `Esc` | Select all · Clear selection |
| Arrows · `Shift`+Arrows | Move 1px · 10px |
| `Ctrl/⌘ ]` `[` (+`Shift`) | Forward/backward (to front/back) |
| `Space` | Play / pause |
| `Home` · `End` | Jump to start · end |
| `Ctrl/⌘ S` · `P` · `E` | Save · Preview · Export |
| `Ctrl/⌘ 0` · `+` · `−` | Fit · Zoom in · out |
| `?` | Shortcut reference |

Suppressed while typing in any input, and while a modal owns the keyboard. With
nothing selected, ←/→ scrub the timeline instead of nudging.

---

## Playback

- `usePlaybackClock` drives `currentTime` from `requestAnimationFrame` using **real
  elapsed time**, so playback tracks the wall clock even when a heavy frame drops.
  Looping carries the overshoot rather than drifting slow.
- `useAudioPlayback` keeps `<audio>` elements in step, seeking only when drift
  exceeds 0.25 s — assigning `currentTime` every frame causes stutter.
- Audio elements are created **without `crossOrigin`**. Playback never needs CORS
  (only canvas pixel access does), and requiring it turns any un-headered host into
  silent failure. `src` is assigned last, since setting it in the constructor starts
  the fetch before later properties can affect it.
- A file that fails to load is flagged in `unavailableAudioIds` and surfaced in the
  timeline and inspector, rather than being silence with no explanation.
