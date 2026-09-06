# API reference

[← Back to README](../README.md)

Base URL: `http://localhost:5030/v1`

---

## Conventions

Every response uses the same envelope:

```jsonc
// success
{ "status": "success", "message": "Project saved.", "data": { /* … */ } }

// failure
{ "status": "failed", "message": "Project not found.", "details": { /* optional */ } }
```

**No authentication.** The studio is single-tenant, so every route is open and
nothing is owner-scoped. Do not expose this API beyond a trusted network without
adding an auth layer and restoring per-resource ownership together.

| Status | Meaning |
|---|---|
| 400 | Validation failed |
| 403 | Revision conflict |
| 404 | Not found |

---

## Projects

### `POST /projects`

```jsonc
{
  "name": "TechFest 2026",
  "canvas": { "width": 1080, "height": 1920, "fps": 30, "duration": 10 },
  "templateSlug": "college-tech-fest",   // optional
  "document": { /* … */ }                // optional (AI generation)
}
```

Returns **201** with the project including its `document`.

A seeded document is re-validated and **refitted to the chosen canvas**: layers are
scaled by the smaller axis ratio and re-centred, type and letter-spacing scale with
it, and clips are clamped to the duration. A 9:16 template dropped on a 16:9 canvas
stays composed instead of sitting in a corner.

### `GET /projects`

Query: `page` (1), `limit` (24, max 60), `search`, `status`.

Returns `{ items, page, limit, total, hasMore }`. **Never includes `projectData`** —
24 full documents would be megabytes.

### `GET /projects/:id`

The full project including `document`. Stamps `lastOpenedAt` fire-and-forget.

### `PATCH /projects/:id`

The autosave endpoint.

```jsonc
{
  "name": "…",                // all fields optional
  "document": { /* … */ },
  "thumbnail": "data:image/webp;base64,…",
  "status": "READY",
  "baseRevision": 4           // optimistic concurrency
}
```

If `baseRevision` is stale → **403**:

```jsonc
{ "status": "failed",
  "message": "This project was changed somewhere else. Reload…",
  "details": { "error": "REVISION_CONFLICT", "currentRevision": 5 } }
```

Thumbnails must be a PNG/JPEG/WebP **data URL**; anything else is rejected so the
dashboard cannot be pointed at an arbitrary remote resource.

### `DELETE /projects/:id`

Deletes the project and its export history together, so no orphans remain.

### `POST /projects/:id/duplicate` · `POST /projects/:id/canvas`

Duplicate returns **201**. Canvas takes `{ "preset": "youtube" }` and rescales every
layer.

---

## Assets

Three steps, so bytes never pass through the API process.

### 1 · `POST /assets/upload-url`

```jsonc
{ "kind": "IMAGE", "filename": "logo.png", "mimeType": "image/png", "size": 84213 }
```

Policy is enforced **before** a key is issued, so an oversized or wrong-typed file
never occupies one:

| Kind | Max | Types |
|---|---|---|
| IMAGE | 15 MB | png, jpeg, webp, gif, svg, avif |
| LOGO | 5 MB | png, jpeg, webp, svg |
| VIDEO | 200 MB | mp4, webm, quicktime |
| AUDIO | 30 MB | mpeg, mp3, wav, ogg, aac, mp4, webm |

Returns a ticket:

```jsonc
{ "uploadUrl": "…", "headers": { "Content-Type": "image/png" },
  "storagePath": "media/image/<random>-logo.png",
  "publicUrl": "…", "expiresAt": "…" }
```

### 2 · `PUT <uploadUrl>`

Raw bytes, with the returned headers. Goes straight to GCS, or to the local
driver's HMAC-signed endpoint.

### 3 · `POST /assets/confirm`

```jsonc
{ "storagePath": "users/…", "kind": "IMAGE", "filename": "logo.png",
  "mimeType": "image/png", "size": 84213,
  "metadata": { "width": 512, "height": 512 } }
```

Returns **201** with the asset in `PENDING` so the editor can place it immediately;
verification and thumbnailing run in the background. Confirming a key outside the
`media/` prefix is rejected, so only keys this API issued can be registered.

### `GET /assets` · `GET /assets/:id` · `DELETE /assets/:id`

List takes `page`, `limit` (40, max 100), `kind`, `projectId`, `search`.

---

## Templates

### `GET /templates`

Query: `category`, `search`, `featured`. Returns `{ items, categories }` **without**
`projectData` — the grid renders from summaries rather than downloading ten complete
projects.

### `GET /templates/:slug`

The full template including `projectData`. Fetched on demand when a card is
previewed or used.

---

## Exports

### `POST /projects/:id/exports`

```jsonc
{ "format": "mp4", "quality": "high", "fps": 30 }
```

Returns **202** with the job row and an `estimatedSeconds`.

Rejects an empty project, and rejects a second export while one is active:

```jsonc
{ "status": "failed",
  "message": "This project is already being exported…",
  "details": { "error": "EXPORT_IN_PROGRESS", "jobId": "…" } }
```

### `GET /exports/:id`

```jsonc
{ "id": "…", "status": "PROCESSING", "progress": 42, "stage": "rendering",
  "format": "mp4", "quality": "high", "width": 1080, "height": 1920, "fps": 30,
  "durationSeconds": 10, "outputUrl": null, "fileSize": null,
  "errorCode": null, "attempt": 1, "createdAt": "…", "completedAt": null }
```

`projectSnapshot` and `errorDetail` are always stripped.

### `POST /exports/:id/retry`

Only from `FAILED` or `CANCELLED`. Creates a **new** job and **re-snapshots from the
live project** — the user has usually fixed whatever broke, and retrying the same bad
snapshot would just fail again. Returns **202**.

### `POST /exports/:id/cancel`

Marks cancelled first, then flags the in-flight render. If it is already rendering,
the runner discards the output when it finishes.

### `GET /exports/:id/download`

Query: `disposition=attachment` (default) or `inline`.

Checks ownership, then **302**s to a short-lived signed URL (GCS) or streams the file
(local), with `Content-Disposition` set and a filename derived from the project.

### `GET /projects/:id/exports`

The 20 most recent jobs for a project.

---

## AI

### `POST /ai/advertisements`

```jsonc
{ "subject": "College Tech Fest",
  "description": "Annual technology festival. 40+ events…",
  "style": "modern", "preset": "instagram-reel", "duration": 10 }
```

Returns a **document**, not a project:

```jsonc
{ "document": { /* validated project document */ },
  "plan": { "headline": "…", "scenes": [ … ], "cta": "…", "palette": [ … ] },
  "generator": "openai" | "heuristic",
  "suggestedName": "…" }
```

Nothing is written to the database. The client shows the plan for review, then
creates a project through `POST /projects`, which validates it again. See
[ai.md](ai.md).

---

## Progress reporting

There is no websocket. Long-running work reports by writing to its own row, and the
client polls:

| Work | Endpoint | Interval |
|---|---|---|
| Export render | `GET /exports/:id` | 2.5s while active, stops at a terminal state |
| Asset processing | `GET /assets/:id` | until the asset leaves `PENDING` |
