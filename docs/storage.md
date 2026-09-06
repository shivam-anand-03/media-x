# Storage

[← Back to README](../README.md)

Source: [`apps/server/src/common/services/object-storage.service.ts`](../apps/server/src/common/services/object-storage.service.ts)

---

## The handshake

Media never flows through the API process. The browser asks for a ticket, PUTs the
bytes straight at storage, then confirms:

```
Browser                       API                        Storage
   │  POST /assets/upload-url  │                            │
   │ ─────────────────────────►│  validate policy           │
   │                           │  issue ticket              │
   │ ◄─────────────────────────│                            │
   │                                                        │
   │  PUT <uploadUrl>  (raw bytes) ────────────────────────►│
   │                                                        │
   │  POST /assets/confirm     │                            │
   │ ─────────────────────────►│  create Asset (PENDING)    │
   │                           │  start processing ─────────►
```

The handshake is defined by the `StorageDriver` interface rather than by the one
implementation, so a bucket-backed driver could be added later without the browser
code changing at all.

---

## The driver

One driver ships: **local disk**. Files land in `apps/server/uploads/` and are served
from `/uploads`. Zero configuration, and nothing to reach over the network.

The upload target is `PUT /v1/assets/upload`. Authorisation comes from an **HMAC-signed
ticket** binding the key, content type, size and expiry — without it that route
would be an open write endpoint. Paths are resolved and rejected if they escape the
uploads root.

> There is no cloud storage driver. Uploads, thumbnails and rendered exports all live
> on the server's disk, which means `apps/server/uploads/` is real state: back it up,
> and mount it on a volume if the process runs in a container.

---

## Reading files back

Two different needs, two different mechanisms.

### Assets → stable public URLs

A saved project references media **by URL, inside the document**, so that URL has to
stay valid indefinitely — an expiring URL would silently break the project weeks
later. Assets are therefore served from the stable `/uploads/<key>` address. Storage
keys are long and random (`media/<kind>/<timestamp>-<12 hex>-<name>`), so they are
not guessable.

### Exports → streamed through the API

Finished videos are not linked directly. `GET /v1/exports/:id/download` streams the
file with a `Content-Disposition` header, which is what actually makes the browser
save it under a sensible name — a cross-origin `<a download>` is ignored, so the
header has to come from the response. It also keeps the export tree out of the
publicly-served `/uploads` path.

---

### The boot preflight

Storage is only exercised on upload and export, both long after startup. So the
server checks write access at boot, while someone is still watching the logs:

```
🗄️  Storage ready (local)
```

or, when it cannot write:

```
🗄️  Storage driver "local" cannot write — uploads and exports will fail:
    EACCES: permission denied, mkdir '/srv/app/apps/server/uploads'
```

Loud but **non-fatal** — the rest of the app works fine without uploads.

---

## CORS

Uploaded media is loaded by the editor's canvas, which needs pixel access for
thumbnail capture — so images and video are requested with
`crossOrigin="anonymous"`, and the browser then requires CORS headers.

`cors()` is registered *before* the `/uploads` static mount. Order matters: mounted
first, static files get no `Access-Control-Allow-Origin` and every image and video
silently fails to load.

> **Audio elements deliberately do *not* set `crossOrigin`.** Playback never needs
> CORS — only canvas pixel access does — and requiring it turns any un-headered host
> into silent failure with no error. `src` is also assigned *after* the element is
> configured, because setting it in the constructor starts the fetch before later
> properties can take effect.

---

## Interface

```ts
interface StorageDriver {
  readonly name: "local";
  createUploadTicket(input): Promise<UploadTicket>;
  head(storagePath): Promise<{ exists: boolean; size: number }>;
  putBuffer(storagePath, buffer, mimeType): Promise<string>;
  publicUrl(storagePath): string;
  delete(storagePath): Promise<void>;
  signedReadUrl(storagePath, opts?): Promise<string>;
  verifyWritable(): Promise<{ ok: boolean; reason?: string }>;
}
```

Adding S3, R2, GCS or Azure means implementing this interface and returning it from
`objectStorage()`. Nothing else changes.

---

## Asset processing

After confirm, background asset processing:

1. verifies the object actually landed (`head`) — catching uploads that silently
   failed,
2. trusts the real byte count over the size the client claimed,
3. generates a 480px WebP thumbnail for images via `sharp`,
4. flips the asset to `READY`; the client polls `GET /assets/:id` until it settles.

A failed thumbnail is a cosmetic downgrade, not a reason to mark a good upload
broken — `sharp` is imported lazily and its failure is swallowed. A genuinely missing
object marks the asset `FAILED`.
