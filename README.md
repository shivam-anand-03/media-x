# Motion Studio

A motion-graphics advertisement editor for students. Design, animate, preview and
export professional short-form video ads — canvas, timeline, animation engine and
server-side MP4 rendering in one workspace.

Built on an existing Next.js + Express + MongoDB monorepo.

---

## What it does

| | |
|---|---|
| **Canvas** | Drag, resize, rotate and arrange layers with snapping and alignment guides |
| **Timeline** | Real clip timing — drag to move, pull an edge to retime, scrub, play |
| **Animation** | 10 entrances, 7 exits, 5 loops, each with duration, delay, easing and intensity |
| **Templates** | 10 complete, editable advertisements that load straight into the editor |
| **Media** | Direct-to-storage uploads for images, video and audio |
| **Audio** | Music and SFX tracks with trim, volume, fade in/out, and in-panel auditioning |
| **Preview** | Immersive playback using the *same renderer* as the export |
| **Export** | Server-side render to MP4/WebM/GIF via Remotion + FFmpeg |
| **AI** | Generate a complete, editable advertisement from a text description |

---

## Quick start

```bash
# 1. Install
pnpm install

# 2. Configure — MONGODB_URI is the only value you must set
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env

# 3. Run
pnpm dev
```

- Client → <http://localhost:3000>
- API → <http://localhost:5030>

Everything works with **zero cloud credentials**: storage defaults to the local
driver, and AI generation falls back to a built-in offline planner. MongoDB is the
only external service — there is no Redis, broker or container runtime, and no
sign-in: the studio is single-tenant and opens straight into the workspace.

Full setup, prerequisites and troubleshooting: **[docs/getting-started.md](docs/getting-started.md)**

---

## The core idea

Three things must never disagree: what you **edit**, what you **preview**, and what
gets **encoded**. They are kept in sync structurally rather than by discipline:

```
                    @workspace/motion
              (schema · animation engine · layer ops)
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Editor canvas       Preview player      Remotion render
     (Konva)          ─── @workspace/renderer ───
                       (one DOM renderer, shared)
```

`resolveLayerAtTime(layer, time)` is the single function that decides what a layer
looks like at any instant. The editor, the preview and the video encoder all call
it. Preview and export additionally share the *same React components*, so a frame
you preview is the frame you get.

Architecture, decisions and trade-offs: **[docs/architecture.md](docs/architecture.md)**

---

## Repository layout

```
apps/
  client/                  Next.js 15 app (dashboard, editor)
    modules/studio/        All editor code — canvas, timeline, inspector, panels
  server/                  Express API
    src/module/            project · asset · export · template · ai
    src/renderer/          Remotion + FFmpeg render service, in-process runner

packages/
  motion/                  Domain core — schema, animation, templates (no React/Node)
  renderer/                Shared DOM renderer: preview + Remotion composition
  ui/                      shadcn/ui component library + design tokens
  data-access/             RTK Query base query + store
  schema/                  Shared zod schemas
```

---

## Documentation

| Document | What's in it |
|---|---|
| [Getting started](docs/getting-started.md) | Prerequisites, install, env vars, running, troubleshooting |
| [Architecture](docs/architecture.md) | How the pieces fit, key decisions and why |
| [Data model](docs/data-model.md) | Project document schema, collections, validation |
| [Editor](docs/editor.md) | Store, undo/redo, autosave, canvas, timeline, animation |
| [Rendering & export](docs/rendering.md) | The full render → Remotion → FFmpeg → storage pipeline |
| [API reference](docs/api.md) | Every endpoint, with request/response shapes |
| [Storage](docs/storage.md) | Local vs GCS drivers, signed uploads and downloads |
| [Templates](docs/templates.md) | The library, and how to author a new one |
| [AI generation](docs/ai.md) | Plan → compile → validate, and the provider abstraction |
| [Theming](docs/theming.md) | Design tokens, the golden theme, contrast rules |
| [Testing](docs/testing.md) | What's covered, what isn't, how to run it |
| [Troubleshooting](docs/troubleshooting.md) | Common failures, diagnostics, known limitations |

---

## Commands

```bash
pnpm dev              # everything (turbo)
pnpm build            # build client + server
pnpm test             # all test suites
pnpm type-check       # typecheck every package
pnpm lint             # lint
```

---

## Status

**99 tests** across three suites; typecheck, lint and both production builds are clean.

The export pipeline has been verified end-to-end against a real render — a started
job produced a valid H.264/AAC MP4, and frames were rendered and visually checked.

Known limitations are listed in [docs/troubleshooting.md](docs/troubleshooting.md#known-limitations).

---

## Tech

Next.js 15 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Zustand · RTK Query ·
Konva · Express · MongoDB/Mongoose · Remotion · FFmpeg · Zod · Vitest
