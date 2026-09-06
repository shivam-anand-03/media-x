# Troubleshooting

[← Back to README](../README.md)

---

## Startup

**`EADDRINUSE :5030`**
Something already holds the port.
`PORT=5055 SERVER_APP_URL=http://localhost:5055 pnpm --filter server dev`

**Redis connection refused**
The API calls `cache.ping()` during boot and exits if it fails. Run `pnpm dev:infra`,
or point `REDIS_HOST`/`REDIS_PORT` at your instance. (Pre-existing behaviour of this
codebase, not specific to the studio.)

**Templates page is empty**
Seeding runs at boot and logs `🎬 Templates seeded`. If it is missing, MongoDB was
unreachable — seeding is non-fatal by design and never blocks startup.

**`🗄️ Storage driver "gcs" cannot write`**
The boot preflight caught a misconfiguration and printed the exact `gcloud` command.
See [storage](storage.md#switching-to-gcs).

---

## Media

**"Video unavailable" / "Image unavailable" on the canvas**

1. **Does the file exist?** With `STORAGE_DRIVER=local`, check
   `apps/server/uploads/`. Deleting that directory orphans asset records — the
   library still lists them, but every URL 404s.
2. **CORS.** The canvas loads media with `crossOrigin="anonymous"` (needed for
   thumbnail capture), so a response without `Access-Control-Allow-Origin` fails.
   Verify:
   ```bash
   curl -I http://localhost:5030/uploads/<path> -H "Origin: http://localhost:3000"
   ```
   You should see `Access-Control-Allow-Origin`. If not, `cors()` must be registered
   *before* the `/uploads` static mount in `app.ts` — mounted first, static files get
   no CORS headers and every image and video silently fails.
3. **On GCS**, the bucket needs a CORS policy allowing your client origin.

**Audio is silent**

- Check the timeline clip — a red clip reading *"file unavailable"* means the file
  could not be loaded. Use **Replace audio file** in the inspector; the clip keeps
  its timing, fades and volume.
- Open the console. Playback failures log `[audio] could not play "…"` rather than
  failing quietly.
- Audio elements deliberately do **not** set `crossOrigin` — playback never needs
  CORS, and requiring it turns any un-headered host into silence. If you add it back,
  expect this failure.
- Browsers block autoplay until the page has been interacted with; pressing Play
  counts.

**Uploads fail**

Check the MIME type and size against the [policy](api.md#1--post-assetsupload-url).
Policy is enforced *before* a storage key is issued, so the error arrives up front.

---

## Export

**The dialog shows a reference code** — map it via
[rendering → failure codes](rendering.md#failure-codes).

| Code | Usual cause |
|---|---|
| `WORKER_UNAVAILABLE` | Redis down, no worker running, or Remotion not installed |
| `ASSET_UNAVAILABLE` | A layer's media URL 404s — see *Media* above |
| `TIMEOUT` | Exceeded `RENDER_TIMEOUT_MS` (default 10 min) |
| `INVALID_PROJECT` | The stored snapshot failed schema validation |
| `STORAGE_FAILED` | Could not upload the finished file |

**The first export takes several minutes**
Remotion is downloading Chrome (~150 MB, once). The log shows
`Downloading Chrome Headless Shell`. Set `REMOTION_BROWSER_EXECUTABLE` to reuse an
existing Chrome and skip it.

**"This project is already being exported"**
One active export per project. Wait, or cancel it.

**The exported video is cropped**
Fixed — the composition now scales the stage to the export resolution. If it
reappears, check `AdvertisementComposition`: the stage lays out at the document's
native size while the composition is sized to the *export* resolution, and something
has to bridge the two.

---

## Editor

**"Maximum update depth exceeded" / "getSnapshot should be cached"**
A selector is returning a **new reference** every call. Zustand compares snapshots by
reference, so a selector that builds an array or object re-renders forever:

```ts
// ✗ new array every call
const colors = useEditorStore((s) => collectProjectColors(s.document));

// ✓ select the stable document, memoise the derivation
const colors = useProjectColors();
```

`.find()` is safe — it returns an existing object reference.

**Undo rewinds too much or too little**
A drag should be one step. It must be wrapped:

```ts
store.beginInteraction(id);                       // one snapshot
store.patchLayerTransform(id, …, { transient: true });   // no snapshots
store.endInteraction();
```

**Text wraps mid-word**
The box is narrower than the copy. `estimateTextWidth` accounts for weight, letter
spacing and capitals; templates shrink the font to fit rather than wrapping. A test
guards every template — see [templates](templates.md#type-is-fitted-not-wrapped).

**Changes are not saving**
Watch the toolbar indicator. `Unable to save` shows the reason and a Retry.
`REVISION_CONFLICT` means another tab saved first — reload to continue.

---

## Known limitations

- **Thumbnails** render background, shapes and text only. Images and icons are
  skipped because they would need async decoding; the block layout is still enough to
  identify a project.
- **Konva text metrics** differ slightly from the DOM renderer. Preview is the
  authority — it *is* the export renderer.
- **Scene transitions** animate the incoming scene. There is no cross-fade between
  two simultaneously rendered scenes.
- **No marquee multi-select** on the canvas yet. Shift/⌘-click and the layer panel
  both work.
- **Video layers in the editor** are drawn by seeking a hidden `<video>`, so
  scrubbing is approximate. The export is frame-accurate via `OffthreadVideo`.
- **`makePublic` is a no-op** on buckets with uniform bucket-level access; access is
  governed by bucket IAM there instead.
- **One render at a time** by default (`RENDER_CONCURRENCY=1`). Raise it only with
  the RAM to match — each render runs a Chrome instance.
- **Deleting `apps/server/uploads/`** orphans asset records. There is no garbage
  collector; use **Replace file** on affected layers.

---

## Diagnostics

```bash
# API alive?
curl http://localhost:5030/health

# CORS on uploaded media
curl -I http://localhost:5030/uploads/<path> -H "Origin: http://localhost:3000"

# Storage writable? (also runs at boot)
grep "Storage" <server log>

# Queues
redis-cli KEYS "bull:video-render:*"

# Everything green?
pnpm type-check && pnpm test && pnpm lint
```

Full error detail — including stack traces — is logged server-side and stored in
`ExportJob.errorDetail`. It is never returned by the API.
