import { AssetModel, AssetStatus, AssetType } from "@/core/models";
import { objectStorage } from "./object-storage.service";
import { logger } from "../helper/logger";

/**
 * Post-upload asset processing.
 *
 * Confirming an upload returns immediately with the asset in `PENDING` so the
 * editor can place it right away; this runs just after, off the request, to
 * verify the object really landed in storage, derive a thumbnail where it can,
 * and flip the asset to `READY`. Splitting it this way keeps the confirm
 * request fast while still catching uploads that silently failed.
 *
 * The client polls `GET /v1/assets/:id` until the status settles, so there is
 * nothing to push and no progress to report — the asset row is the whole
 * contract.
 */

/** Assets currently being processed, so a double-confirm cannot double-run. */
const inFlight = new Set<string>();

/** Kicks off processing and returns immediately. */
export function startAssetProcessing(assetId: string): void {
  if (inFlight.has(assetId)) return;
  inFlight.add(assetId);

  void processAsset(assetId)
    .catch((error) => {
      logger.error("Asset processing crashed", {
        assetId,
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
    })
    .finally(() => inFlight.delete(assetId));
}

async function processAsset(assetId: string): Promise<void> {
  const asset = await AssetModel.findById(assetId);
  if (!asset) {
    logger.warn("Asset processing references a missing asset", { assetId });
    return;
  }
  if (asset.status === AssetStatus.READY) return;

  try {
    const storage = objectStorage();
    const head = await storage.head(asset.storagePath);

    if (!head.exists) {
      throw new Error("Uploaded object was not found in storage");
    }

    // Trust the bytes that actually arrived over the size the client claimed.
    if (head.size > 0 && head.size !== asset.size) {
      asset.size = head.size;
    }

    if (asset.type === AssetType.IMAGE || asset.type === AssetType.LOGO) {
      const thumb = await buildImageThumbnail(asset.storagePath, asset.mimeType);
      if (thumb) asset.thumbnailUrl = thumb;
    }

    asset.status = AssetStatus.READY;
    asset.error = null;
    await asset.save();

    logger.info("Asset processed", { assetId, type: asset.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Asset processing failed", { assetId, error: message });

    await AssetModel.updateOne(
      { _id: assetId },
      {
        status: AssetStatus.FAILED,
        error: "We could not process this file. Please try uploading it again.",
      },
    ).catch(() => {});
  }
}

/**
 * Downscales an image for grid thumbnails. `sharp` is loaded lazily and a
 * failure is non-fatal: a missing thumbnail is a cosmetic downgrade, not a
 * reason to mark a perfectly good upload broken.
 */
async function buildImageThumbnail(storagePath: string, mimeType: string): Promise<string | null> {
  if (mimeType === "image/svg+xml" || mimeType === "image/gif") return null;

  try {
    const { default: sharp } = (await import("sharp")) as { default: typeof import("sharp") };

    const source = await readObject(storagePath);
    if (!source) return null;

    const buffer = await sharp(source)
      .resize(480, 480, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    return await objectStorage().putBuffer(`${storagePath}.thumb.webp`, buffer, "image/webp");
  } catch (error) {
    logger.warn("Thumbnail generation skipped", {
      storagePath,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function readObject(storagePath: string): Promise<Buffer | null> {
  const path = await import("path");
  const { promises: fs } = await import("fs");
  return fs.readFile(path.join(process.cwd(), "uploads", storagePath)).catch(() => null);
}
