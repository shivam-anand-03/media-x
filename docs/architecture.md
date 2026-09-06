# Architecture

[← Back to README](../README.md)

---

## The problem this shape solves

An advertisement editor has three views of the same thing:

1. what you **edit** on the canvas,
2. what you **preview**,
3. what the encoder actually **writes to an MP4**.

If those are three implementations, they drift — an animation eases differently in
the export, text wraps in the video but not on screen, a layer is a few pixels off.
The drift is invisible until someone downloads the file.

So they are not three implementations.

```
                       @workspace/motion
        ┌──────────────────────────────────────────────┐
        │  zod schema  ·  animation engine  ·  layer   │
        │  operations  ·  templates  ·  export domain  │
        │        (no React, no Node, no browser)       │
        └──────────────────────────────────────────────┘
                              │
          resolveLayerAtTime(layer, time) → ResolvedLayer
                              │
        ┌─────────────────────┼─────────────────────────┐
        ▼                     ▼                         ▼
  Editor canvas         Preview player            Remotion render
   (react-konva)                                  (headless Chrome)
                        └──── @workspace/renderer ────┘
                            one DOM renderer, shared
```

- **One animation engine.** `resolveLayerAtTime` is the only code that decides a
  layer's position, scale, rotation, opacity and blur at an instant. All three
  consumers call it, so timing and motion cannot diverge.
- **One paint layer for preview and export.** The preview modal and the Remotion
  composition render the *same React components* (`AdvertisementStage`). A previewed
  frame is the exported frame.
- **The editing surface is separate on purpose.** Konva gives real hit-testing,
  transform handles and snapping — things a DOM renderer would have to reimplement.
  It reads the same resolved values, so it agrees on geometry and motion.

---

## Packages

| Package | Depends on | Role |
|---|---|---|
| `@workspace/motion` | zod | Domain core. Pure TypeScript — runs in a browser, in Node, and inside a webpack bundle. |
| `@workspace/renderer` | motion, react, remotion | The DOM renderer. `./preview` is a browser-safe entry with no Remotion runtime. |
| `client` | motion, renderer, ui | Next.js app. All editor code under `modules/studio/`. |
| `server` | motion, renderer | Express API, BullMQ workers, Remotion render service. |
| `@workspace/ui` | — | shadcn/ui components and design tokens (pre-existing). |
| `@workspace/data-access` | RTK Query | Base query with auth refresh (pre-existing). |

`@workspace/motion` deliberately has **one** dependency. It is imported by a browser
bundle, a CommonJS Node build and a Remotion webpack bundle; anything heavier would
have to work in all three.

---

## Request and data flow

### Editing

```
User gesture
   → Zustand store (editorStore)          synchronous, in memory
   → document replaced immutably
   → subscribers re-render (selectors)
   → dirtyCounter++
   → debounced autosave (1.2s, 8s max)
   → PATCH /projects/:id
   → Mongo
```

Nothing in the editor awaits the network. The document is the source of truth in
memory; persistence trails behind it.

### Exporting

```
POST /projects/:id/exports
   → validate the document (zod)
   → snapshot it onto an ExportJob row (QUEUED)
   → enqueue on BullMQ  ──────────► Redis
                                      │
                          render worker picks it up
                                      │
   ┌──────────────────────────────────┴───────────────────┐
   │ validate → prepare → render → encode → upload → done │
   │           Remotion (Chrome)     FFmpeg    storage     │
   └──────────────────────────────────┬───────────────────┘
                                      │
              progress → socket ──────┴──► export dialog
                       → ExportJob row ──► polling fallback
```

Rendering never happens inside an HTTP request. Full detail in
[rendering.md](rendering.md).

---

## Decisions worth knowing

### MongoDB, not Prisma/Postgres

The brief asked for Prisma + Postgres. This repo already had MongoDB, Mongoose
models, auth built on them, and a `BaseQueueService`. Switching would have meant
rewriting authentication for no user-visible gain. The project document is stored as
one `Mixed` subdocument — Mongo's native equivalent of the JSONB column the brief
described. Its shape is owned by the zod schema, not by Mongoose.

### RTK Query, not TanStack Query

Same reasoning: the app already had a configured RTK Query instance with token
refresh and a shared store. Studio endpoints are injected into it.

### Konva for the canvas, DOM for the render

Konva was the stated preference and is genuinely better for an editing surface —
`Transformer` alone saves a lot of handle maths. But Remotion renders a web page, so
the export path is DOM. The shared animation engine is what keeps them agreeing;
see the diagram above.

### Undo is a snapshot stack, never a refetch

Every mutation is `document → document`. `commit()` pushes the previous document
onto `past` before applying the next. That makes every operation undoable by
construction — a new action cannot forget to be undoable. Drags collapse into one
entry via `beginInteraction`/`endInteraction`.

### The schema is the trust boundary

`projectDocumentSchema` is parsed on every path where a document enters the system:
API writes, template seeding, AI output, and again inside the render worker before
Remotion sees it. Asset URLs are restricted to `http(s)` and `data:` so a hostile
document cannot point the worker at `file:///etc/passwd`.

### Media never flows through the API

The browser asks for an upload ticket, PUTs bytes straight at storage, then
confirms. The API process handles metadata only. Both storage drivers implement the
same handshake, so the client code is identical whether the deployment has a GCS
bucket or nothing configured.

---

## Performance

The editor stays responsive on large projects through a few specific choices.

- **Only visible layers render.** `resolveLayerAtTime` filters by the playhead, so a
  200-layer project with 8 layers on screen mounts 8 nodes.
- **Layer nodes are memoised on resolved values**, not on the document. During
  playback only layers whose appearance actually changed re-render.
- **Selectors, not whole-store reads.** Components subscribe to the slice they need,
  so dragging one layer does not re-render the timeline and every other layer.
- **Snap candidates are built once per gesture**, not per pointer-move.
- **Konva is lazy-loaded** and client-only — it touches `window` at import time and
  must never enter the server bundle.
- **Autosave is debounced** on a single integer counter, so it never diffs documents.

---

## Security

| Concern | How it's handled |
|---|---|
| Project access | Ownership is part of the *query*, not a check after it — there is no window where someone else's project is loaded in memory |
| Missing project vs. not yours | Both return 404; a 403 would confirm the id exists |
| Untrusted documents | zod-parsed at every entry point, including inside the render worker |
| Uploads | MIME allow-list and size cap enforced *before* a storage key is issued |
| Upload keys | `users/<userId>/…`; confirming a key outside your own prefix is rejected |
| Local upload endpoint | HMAC-signed ticket binding key, content type, size and expiry |
| Downloads | Ownership checked, then a short-lived signed URL — the bucket stays private |
| Error detail | Stack traces are logged server-side; the client receives a code |

---

## Where things live

```
apps/client/modules/studio/
  api/            RTK Query endpoints (studio-api.ts)
  stores/         editorStore — document, history, selection, playback
  hooks/          autosave, playback clock, shortcuts, uploads, export job
  lib/            snapping
  components/
    canvas/       Konva stage, layer nodes, inline text editor
    timeline/     ruler, tracks, clips
    inspector/    properties, animation, colour picker
    layers/       layer panel
    panels/       tool rail + text/media/elements/audio/background/templates
    editor/       shell, toolbar, preview, export, shortcuts
    dashboard/    project card, create dialog, AI dialog
  views/          dashboard, templates, assets, editor

apps/server/src/
  module/project/   CRUD, rescaling, revision-checked saves
  module/asset/     upload tickets, confirm, list
  module/export/    create, status, retry, cancel, download
  module/template/  browse + seeding
  module/ai/        planner (LLM + offline) and deterministic compiler
  renderer/         Remotion + FFmpeg render service
  common/queue/     render, asset, email queues
  core/models/      project, asset, template, export-job
```
