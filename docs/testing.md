# Testing

[← Back to README](../README.md)

---

## Running

```bash
pnpm test                                  # everything

cd packages/motion && pnpm exec vitest run  # 49 — domain core
cd apps/server    && pnpm exec vitest run   # 16 — services, export, AI
cd apps/client    && pnpm exec vitest run   # 34 — editor store
```

Plus:

```bash
pnpm type-check    # 4 packages
pnpm lint
pnpm build
```

**99 tests.** No database, no network — they run anywhere in about a second.

---

## What is covered, and why

The tests target the places where a bug **corrupts a user's project** or **loses
their work**, not line coverage.

### `packages/motion` — 49 tests

| Area | Covers |
|---|---|
| Schema | Every shipped template parses; rejects `file://` URLs, duplicate layer ids, invalid hex; applies defaults |
| Layer ops | Add, delete, duplicate, update, reorder (single and multi-select), z-index density, edge-of-stack no-ops |
| Timing | Clamps a clip dragged past either end, caps duration, refits everything when the project shortens |
| Animation | Visibility windows, fade ramps, delayed entrances, exits anchored to the span end, slide/zoom offsets, loops, composition, `localTime` |
| Audio | Silent outside its span, fade in/out maths, mute |
| Transitions | Identity for `none`, slide direction and settle |
| Export domain | Terminal states, retry rules, legal transitions, monotonic progress, even output dimensions |
| Text sizing | Every template text layer has a box wide enough for its own copy |

Two are explicit regression guards:

- **Opacity never leaves 0–1**, swept across a layer's whole life with elastic and
  bounce easing at double intensity — the curves overshoot by design, and the
  clamp is what stops a layer flashing.
- **Text box sizing**, because an under-estimated box wraps a headline mid-word, and
  that is invisible until you look at an exported frame.

### `apps/server` — 16 tests

| Area | Covers |
|---|---|
| `buildInitialDocument` | Valid blank project; template seeding; clamps a template longer than the canvas |
| `rescaleDocument` | No-op when unchanged; every layer stays in frame portrait→landscape; type scales; ids preserved |
| Export lifecycle | Only a queued job starts; progress never decreases; dimensions stay even |
| Serialisation | `errorCode` reaches the client; `errorDetail`, `projectSnapshot` and `__v` never do |
| Failure copy | Every render failure code has its own actionable message |
| AI | Heuristic plan compiles to a valid document; layers stay in duration; no unknown icons; palette respected |

The serialisation test exists because of a real bug: the API sends `errorCode` while
the client read `job.error`, so **every** export failure silently showed the generic
message. It locks the field name.

### `apps/client` — 34 tests

Run against the real Zustand store.

| Area | Covers |
|---|---|
| Loading | Clean state; prior project fully cleared |
| Adding | Selects the new layer, marks dirty |
| **Undo/redo** | Add, delete (restoring the layer intact), colour, animation, timing; selection restored; redo branch dropped on new edit; no-op when empty; **history capped** |
| Drag grouping | 20 transient updates collapse to **one** undo step |
| Selection | Replace, additive, toggle, select-all skips locked |
| Locking | Locked layers refuse delete and nudge |
| Clipboard | Copy/paste gets fresh ids; cut; empty paste is a no-op |
| Ordering | Duplicate selects copies; bring to front |
| Playback | Playhead clamped; play at the end restarts |
| Save state | Dirty→saving→saved with revision; error message retained; a no-op update does **not** dirty the project |

---

## What is not covered

Deliberate gaps, with the reasoning:

- **Konva canvas interaction** — dragging and transform handles need a real canvas
  and pointer events. The maths underneath (snapping, animation, transforms) is
  tested; the Konva binding is not.
- **Remotion rendering** — needs headless Chrome and minutes per run. Verified
  manually instead (see below).
- **HTTP layer** — controllers are thin wrappers over tested services; covering them
  would mean a live Mongo for little signal.
- **Component rendering** — no DOM tests. The logic worth testing lives in the store
  and the domain package.

---

## Manual verification performed

The parts that cannot be unit-tested were driven end to end against real MongoDB:

**Full API flow** — templates seeded (10,
with real layer/scene counts); create from template with a format change; autosave;
stale-revision conflict correctly rejected with `REVISION_CONFLICT`; reload returns
the saved state.

**Export pipeline** — `QUEUED` → `PROCESSING` → progressing through stages →
`COMPLETED`, producing a **504,637-byte MP4**. The file was inspected rather than
assumed:

```
ISO Media, MP4 Base Media v1
'ftyp' ✓   moov ✓   mdat ✓   avc1 ✓ (H.264)   mp4a ✓ (AAC)
served: 200 video/mp4
```

**Visual check** — frames rendered at 1.2 s, 5.5 s and 9.0 s and looked at. This is
how two real bugs were found: exports below 100% quality were **cropped to the
top-left corner**, and `TECHFEST` was **wrapping mid-word**. Neither would have been
caught by any assertion I had written.

**Storage** — download verified end to end from local disk (200, correct
`Content-Disposition`); IAM permissions probed to diagnose a read-only service
account.

---

## Adding tests

Put pure logic in `packages/motion` and test it there — it needs no environment.

```ts
it("clamps a clip dragged past the end of the project", () => {
  const doc = baseDoc([createTextLayer(ctx("a"), "heading", "A")]);
  // duration is 5, project is 10 → the furthest valid start is 5.
  expect(setLayerTiming(doc, "a", { startTime: 99 }).layers[0]!.startTime).toBe(5);
});
```

Store behaviour goes in `apps/client/modules/studio/stores/__tests__/`, using the
real store via `useEditorStore.getState()`.

A test name should state the behaviour, not the function — `"restores the selection
that was active at the time of the snapshot"` beats `"undo works"`.
