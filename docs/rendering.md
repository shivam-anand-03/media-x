# Rendering & export

[← Back to README](../README.md)

---

## Pipeline

Rendering never happens inside an HTTP request. The API's whole job is: validate,
snapshot, persist a `QUEUED` row, enqueue.

```
Browser
  │  POST /projects/:id/exports  { format, quality, fps? }
  ▼
API ── validate document (zod) ── snapshot ── ExportJob(QUEUED) ── enqueue
                                                                     │
                                                              BullMQ ▼ Redis
                                                                     │
                                                    render worker picks up
                                                                     │
  ┌──────────────────────────────────────────────────────────────────┴────┐
  │ validating → preparing → rendering → encoding → uploading → finalizing│
  │      zod       bundle     Chrome      FFmpeg     storage              │
  └──────────────────────────────────────────────────────────────────┬────┘
                                                                     │
       socket: EXPORT_PROGRESS ───────────────────────────────► dialog
       ExportJob row updated ──────────── polling fallback ────► dialog
```

Progress arrives two ways on purpose: the socket pushes updates the instant the
worker emits them, and a poll runs as a fallback so a dropped websocket — or a worker
on another instance — cannot leave the bar frozen. Polling stops at a terminal state.

---

## Job lifecycle

```
QUEUED ──► PROCESSING ──► COMPLETED
   │            │
   ├────────────┼──────► FAILED
   └────────────┴──────► CANCELLED
```

Terminal states have **no outgoing edges**. Retry creates a *new* attempt rather than
reopening the row, so the history of a flaky render survives and the state machine
stays acyclic. `canTransition()` is checked by both the API and the worker, so a
late progress event cannot resurrect a cancelled job.

`attempt` counts tries; `rootJobId` links attempts of one lineage.

---

## Stages and progress

Progress is weighted so the bar reflects reality — a bar that spends 90% of its life
at 10% is worse than no bar.

| Stage | Range | What happens |
|---|---|---|
| `validating` | 0–4% | Re-parse the stored snapshot |
| `preparing` | 4–12% | Bundle the Remotion composition, select it |
| `rendering` | 12–78% | Headless Chrome paints frames |
| `encoding` | 78–90% | FFmpeg muxes H.264 + AAC |
| `uploading` | 90–98% | Write to object storage |
| `finalizing` | 98–100% | Update the row, clean up temp files |

Progress is only persisted on meaningful movement — writing every frame would hammer
Mongo 300 times for no visible benefit.

---

## Quality

| Quality | CRF | Scale | Note |
|---|---|---|---|
| draft | 32 | 0.5 | Fastest, half resolution |
| standard | 26 | 0.75 | Balanced |
| high | 21 | 1.0 | Recommended |
| max | 17 | 1.0 | Largest file, slowest |

Output dimensions are forced **even** — H.264 encoders reject odd sizes.

> The composition is sized to the *export* resolution while the stage lays out at the
> document's native size. `AdvertisementComposition` scales between the two. Without
> that, every below-100% export captured only the top-left corner of the artwork —
> this was a real bug, caught by rendering a still and looking at it.

---

## The render service

[`apps/server/src/renderer/render.service.ts`](../apps/server/src/renderer/render.service.ts)

1. Lazily import `@remotion/renderer` and `@remotion/bundler` — an API-only instance,
   or a machine with no Chrome, still boots and serves the whole app.
2. Bundle [`packages/renderer/src/index.ts`](../packages/renderer/src/index.ts).
   Remotion runs its own webpack, so the `@workspace/motion` alias is taught to it
   explicitly. The bundle is cached across renders; a failed bundle is not.
3. `selectComposition` with the document as `inputProps`.
4. `renderMedia` → H.264 (`aac` audio for MP4), `swiftshader` GL, wrapped in a
   timeout.
5. Read the output, upload to storage, return `{ url, storagePath, size }`.
6. **Always** remove the temp directory, success or failure.

A cancel that lands mid-render wins: before publishing a result the worker re-reads
the row, and discards the output if the job was cancelled.

---

## Failure codes

Users never see a stack trace. The worker logs full detail server-side and stores it
in `errorDetail` (stripped from every API response); the client receives a code and
maps it to actionable copy, shown with a reference code in the dialog.

| Code | Message |
|---|---|
| `TIMEOUT` | Took longer than the limit — try a shorter ad or lower quality |
| `INVALID_PROJECT` | Content the renderer could not read; reopen and try again |
| `ASSET_UNAVAILABLE` | Media could not be downloaded; check uploads |
| `STORAGE_FAILED` | Upload failed — your project is safe, try again |
| `WORKER_UNAVAILABLE` | No worker available; saved, try shortly |
| `CANCELLED` | You cancelled it |
| *anything else* | Generic, still reassuring: your project is safe and unchanged |

> Historically **every** failure showed the generic message: the API serialises
> `errorCode` but the client read `job.error`, a field that does not exist, so
> `friendlyExportError(undefined)` always fell through. Two regression tests now
> lock the field name and assert each code has distinct copy.

---

## Queues

`BaseQueueService` (pre-existing) — subclasses self-register with the `QueueManager`,
so adding a queue never means editing the manager.

| Queue | Concurrency | Attempts | Purpose |
|---|---|---|---|
| `video-render` | `RENDER_CONCURRENCY` (1) | **1** | Render one export |
| `asset-processing` | 4 | 3, exponential | Verify upload, thumbnail, mark READY |
| `email-queue` | 100 | 3 | Pre-existing |

Renders get **one** attempt deliberately: they are expensive and long, so a blind
retry doubles the cost of a genuine failure. Retrying is an explicit user action.

**Idempotency.** The job payload carries only identifiers; the worker re-reads the
snapshot from the database, so a replay after a restart cannot use a stale document.
`jobId` is derived from the export id, so enqueueing twice is a no-op. A replayed job
whose row is no longer startable exits quietly.

---

## Downloading

`GET /v1/exports/:id/download[?disposition=inline]`

Ownership is checked here, which is what lets the bucket stay private.

- **GCS** → 302 to a short-lived signed URL carrying `Content-Disposition`. A
  cross-origin `<a download>` is ignored by browsers, so the header has to come from
  storage itself.
- **local** → stream the file with the same header.

The filename is derived from the project name (`my-tech-fest.mp4`).

---

## Verified end to end

A queued export was driven through the real pipeline against a live worker:

```
QUEUED → PROCESSING  5% preparing
                    13% rendering
                    55% rendering
      → COMPLETED   100%   504,637 bytes
```

The output was checked as a real file, not just a non-zero size:

```
ISO Media, MP4 Base Media v1
first box: 'ftyp'   moov ✓   mdat ✓   avc1 ✓ (H.264)   mp4a ✓ (AAC)
served: 200 video/mp4
```

Frames were then rendered and visually inspected — headline, icon and CTA pill all
present and correctly laid out.
