# Getting started

[← Back to README](../README.md)

---

## Prerequisites

| | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | 24.x is what this was developed against |
| pnpm | 10.x | `packageManager` pins the exact version |
| MongoDB | 7.x | Local, or MongoDB Atlas — the only external service required |

**Not required to develop:** FFmpeg and Chrome. Remotion bundles its own FFmpeg and
downloads a headless Chrome on the first render (~150 MB, once).

There is no Redis, no message broker and no container runtime to install. Renders
run inside the API process and report progress through the export job row in
MongoDB, which the client polls.

---

## Install

```bash
pnpm install
```

## Configure

```bash
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env
```

### Server — the ones that matter

`MONGODB_URI` is the only value you must set. Everything else has a working
default.

```bash
PORT=5030
MONGODB_URI="mongodb://127.0.0.1:27017/motion_studio"

CLIENT_WEB_APP_URL="http://localhost:3000"
SERVER_APP_URL="http://localhost:5030"      # used to build upload + media URLs

STORAGE_DRIVER="local"                       # local | gcs
UPLOAD_SIGNING_SECRET="change-me-in-production"
```

### Client

```bash
NEXT_PUBLIC_WEB_SERVER_URL="http://localhost:5030/v1"
```

Note the `/v1` — the client talks to the versioned API prefix.

### Optional

| Variable | Default | Effect |
|---|---|---|
| `STORAGE_DRIVER` | `local` | `gcs` uploads to a bucket instead of disk — see [storage](storage.md) |
| `OPEN_AI_API_KEY` | — | Enables the LLM planner; without it the offline planner is used |
| `RENDER_CONCURRENCY` | `1` | Simultaneous renders in the API process — each costs a Chrome |
| `RENDER_TIMEOUT_MS` | `600000` | Hard ceiling on a single render |
| `REMOTION_BROWSER_EXECUTABLE` | — | Path to an existing Chrome, to skip the download |

> **Watch the underscore.** The code reads `OPEN_AI_API_KEY`, not `OPENAI_API_KEY`.
> With the wrong name the AI generator silently falls back to the offline planner.

## Run

```bash
pnpm dev
```

| | |
|---|---|
| Client | <http://localhost:3000> |
| API | <http://localhost:5030> |
| Health | <http://localhost:5030/health> |

A healthy boot logs:

```
MongoDB connected successfully
Pinecone client initialized
🎬 Templates seeded {"upserted":10,…}
🗄️  Storage ready (local)
Server started {"port":5030,…}
```

Templates are seeded on every boot as an idempotent upsert, so a fresh database
never opens on an empty Templates page.

---

## First run through the app

There are no accounts — the studio is single-tenant and opens straight into the
workspace.

1. **Dashboard** (`/dashboard`) → *Create advertisement* → pick a format → *Create project*.
2. **Editor** — add text from the left rail, drag it on the canvas, drag its clip on
   the timeline, give it an entrance in the inspector.
3. **Preview** (`Ctrl/⌘ P`) — plays through the shared renderer.
4. **Export** (`Ctrl/⌘ E`) — starts a render; the dialog polls the job for progress.

---

## Commands

```bash
pnpm dev              # everything
pnpm build            # client + server
pnpm test             # all suites
pnpm type-check       # every package
pnpm lint
```

Scoped to one package:

```bash
pnpm --filter client build
pnpm --filter server dev
cd packages/motion && pnpm exec vitest run
```

---

## Troubleshooting

**`EADDRINUSE :5030`** — something already holds the port.
`PORT=5055 SERVER_APP_URL=http://localhost:5055 pnpm --filter server dev`

**Boot stops at MongoDB** — `MONGODB_URI` is wrong or the database is unreachable.
Mongo is a hard boot gate; nothing else starts without it.

**An export is stuck at "queued" after a restart** — it isn't. Renders live in the
API process, so a restart orphans anything mid-flight; the server fails those rows
at boot with `WORKER_UNAVAILABLE` and the dialog offers a retry.

**Media shows "unavailable" in the editor** — the file's URL is not loading. With
`STORAGE_DRIVER=local`, check the file exists under `apps/server/uploads/`. Deleting
that directory orphans asset records: the library still lists them, but they 404.

**First export takes minutes** — Remotion is downloading Chrome. Watch the server log
for `Downloading Chrome Headless Shell`. Subsequent renders reuse it.

**Export fails immediately** — the dialog shows a reference code. See
[rendering → failure codes](rendering.md#failure-codes).

**`🗄️ Storage driver "gcs" cannot write`** — the boot preflight caught a
misconfiguration and printed the exact IAM command to fix it. See [storage](storage.md).

More: [docs/troubleshooting.md](troubleshooting.md)
