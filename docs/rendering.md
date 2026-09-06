# Rendering & export

[← Back to README](../README.md)

---

## Pipeline

Rendering never happens inside an HTTP request. The API's whole job is: validate,
snapshot, persist a `QUEUED` row, start the render and respond 202.

```
Browser
  │  POST /projects/:id/exports  { format, quality, fps? }
  ▼
API ── validate document (zod) ── snapshot ── ExportJob(QUEUED) ── startRender()
                                                                     │
                                              render-runner (same process, async)
                                                                     │
  ┌──────────────────────────────────────────────────────────────────┴────┐
  │ validating → preparing → rendering → encoding → uploading → finalizing│
  │      zod       bundle     Chrome      FFmpeg     storage              │
  └──────────────────────────────────────────────────────────────────┬────┘
                                                                     │
       ExportJob row updated ──────────── client polls ─────────────► dialog
```

The export job row is the only channel back to the client: the runner writes
progress to it and the dialog polls `GET /v1/exports/:id` every 2.5s, stopping at a
terminal state. Progress writes are throttled to real stage movement, so a 300-frame
render does not produce 300 database writes.

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

## Background work

Both background paths run in the API process. There is no broker.

| Work | Where | Concurrency | Retries |
|---|---|---|---|
| Video render | `src/renderer/render-runner.ts` | `RENDER_CONCURRENCY` (1) | none — retry is a user action |
| Asset processing | `src/common/services/asset-processor.service.ts` | unbounded, per upload | none — the row records the failure |

Renders are serialised behind a small semaphore because each one costs a Chrome
instance; raising `RENDER_CONCURRENCY` on a machine without the RAM to match will
thrash. Renders get **no** automatic retry deliberately: they are expensive and long,
so a blind retry doubles the cost of a genuine failure.

**Idempotency.** `startRender` ignores a job already in flight, and the runner
re-reads the snapshot from the database rather than holding it in memory. A job whose
row is no longer startable exits quietly.

**The trade-off.** Jobs live only as long as the process, so a restart mid-render
loses that render. `reconcileInterruptedJobs()` runs at boot and fails any row still
marked `QUEUED`/`PROCESSING` with `WORKER_UNAVAILABLE`, so the user gets a retry
button rather than a bar frozen at 40%. This is the cost of dropping the broker, and
it is the reason a horizontally-scaled deployment would need one back.

---

## Downloading

`GET /v1/exports/:id/download[?disposition=inline]`

Served through the API, which is what lets the bucket stay private.

- **GCS** → 302 to a short-lived signed URL carrying `Content-Disposition`. A
  cross-origin `<a download>` is ignored by browsers, so the header has to come from
  storage itself.
- **local** → stream the file with the same header.

The filename is derived from the project name (`my-tech-fest.mp4`).

---

## Verified end to end

An export was driven through the real pipeline:

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
