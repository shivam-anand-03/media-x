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
   │                           │  enqueue processing ───────►
```

Both drivers implement exactly this, so the client code is identical whether the
deployment has a GCS bucket or nothing configured at all.

---

## Drivers

Selected by `STORAGE_DRIVER`.

### `local` (default)

Files land in `apps/server/uploads/` and are served from `/uploads`.

The upload target is `PUT /v1/assets/upload`, mounted **before** auth because the
browser sends raw bytes with no cookies. Authorisation comes from an **HMAC-signed
ticket** binding the key, content type, size and expiry — without it that route
would be an open write endpoint. Paths are resolved and rejected if they escape the
uploads root.

Zero configuration. Good for development and single-server deployments.

### `gcs`

Uploads go straight to the bucket via a v4 signed **write** URL, with
`x-goog-content-length-range` binding the size so a ticket for a 2 MB image cannot
be reused for a 2 GB file.

Requires `GCP_PROJECT_ID`, `GCP_BUCKET_NAME`, `GCP_KEY_PATH`.

---

## Reading files back

Two different needs, two different mechanisms.

### Assets → stable public URLs

A saved project references media **by URL, inside the document**. A signed URL would
expire and silently break the project weeks later. So on GCS, uploaded objects are
made public after processing. Storage keys are long and random
(`users/<userId>/<kind>/<timestamp>-<12 hex>-<name>`), so they are not guessable.

`makePublic` fails harmlessly on buckets with uniform bucket-level access, where
per-object ACLs are rejected and access is governed by bucket IAM instead.

### Exports → short-lived signed URLs

Finished videos are **not** public. `GET /v1/exports/:id/download` checks ownership,
then hands back a v4 signed read URL valid for 15 minutes.

The signed URL carries `response-content-disposition`, which is what actually makes
the browser save the file under a sensible name — a cross-origin `<a download>` is
ignored, so the header has to come from the object store itself.

---

## Switching to GCS

```bash
STORAGE_DRIVER="gcs"
GCP_PROJECT_ID="your-project"
GCP_BUCKET_NAME="your-bucket"
GCP_KEY_PATH="./keys/gcp_key.json"
```

The service account needs **write** access to the bucket:

```bash
gcloud storage buckets add-iam-policy-binding gs://YOUR_BUCKET \
  --member=serviceAccount:YOUR_SA@YOUR_PROJECT.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin
```

Read-only credentials are not enough — uploads and exports both write.

### The boot preflight

Storage is only exercised on upload and export, both long after startup. So the
server checks write access at boot, while someone is still watching the logs:

```
🗄️  Storage ready (local)
```

or, when it cannot write:

```
🗄️  Storage driver "gcs" cannot write — uploads and exports will fail:
    the service account is missing storage.objects.create, storage.objects.delete
    on gs://your-bucket. Grant it with: gcloud storage buckets add-iam-policy-binding …
```

Loud but **non-fatal** — the rest of the app works fine without uploads.

Three values must agree, and a mismatch is the most common misconfiguration:

| | |
|---|---|
| `GCP_PROJECT_ID` | the project owning the bucket |
| `GCP_BUCKET_NAME` | the bucket |
| service account in `GCP_KEY_PATH` | must have `objectAdmin` **on that bucket** |

A service account from a different project is fine, *provided* it has been granted
access to the bucket.

---

## CORS

Uploaded media is loaded by the editor's canvas, which needs pixel access for
thumbnail capture — so images and video are requested with
`crossOrigin="anonymous"`, and the browser then requires CORS headers.

- **local** — `cors()` is registered *before* the `/uploads` static mount. Order
  matters: mounted first, static files get no `Access-Control-Allow-Origin` and every
  image and video silently fails to load.
- **gcs** — the bucket needs a CORS policy allowing your client origin:

```json
[{ "origin": ["https://your-app.com"],
   "method": ["GET", "HEAD"],
   "responseHeader": ["Content-Type", "Content-Length", "Range"],
   "maxAgeSeconds": 3600 }]
```

> **Audio elements deliberately do *not* set `crossOrigin`.** Playback never needs
> CORS — only canvas pixel access does — and requiring it turns any un-headered host
> into silent failure with no error. `src` is also assigned *after* the element is
> configured, because setting it in the constructor starts the fetch before later
> properties can take effect.

---

## Interface

```ts
interface StorageDriver {
  readonly name: "gcs" | "local";
  createUploadTicket(input): Promise<UploadTicket>;
  head(storagePath): Promise<{ exists: boolean; size: number }>;
  putBuffer(storagePath, buffer, mimeType): Promise<string>;
  publicUrl(storagePath): string;
  delete(storagePath): Promise<void>;
  signedReadUrl(storagePath, opts?): Promise<string>;
  makePublic?(storagePath): Promise<void>;
  verifyWritable(): Promise<{ ok: boolean; reason?: string }>;
}
```

Adding S3, R2 or Azure means implementing this interface and adding a case to
`objectStorage()`. Nothing else changes.

---

## Asset processing

After confirm, the `asset-processing` queue:

1. verifies the object actually landed (`head`) — catching uploads that silently
   failed,
2. trusts the real byte count over the size the client claimed,
3. generates a 480px WebP thumbnail for images via `sharp`,
4. publishes the object on GCS,
5. flips the asset to `READY` and notifies over the socket.

A failed thumbnail is a cosmetic downgrade, not a reason to mark a good upload
broken — `sharp` is imported lazily and its failure is swallowed. A genuinely missing
object marks the asset `FAILED`.
