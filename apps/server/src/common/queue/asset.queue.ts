import { type Job } from "bullmq";
import { AssetModel, AssetStatus, AssetType } from "@/core/models";
import { BaseQueueService } from "../services/base-queue.service";
import { objectStorage } from "../services/object-storage.service";
import { publishEvent } from "../helper/event-bus";
import { logger } from "../helper/logger";

/**
 * Post-upload asset processing (§32).
 *
 * Confirming an upload returns immediately with the asset in `PENDING` so the
 * editor can place it right away; this queue then verifies the object really
 * landed in storage, derives a thumbnail where it can, and flips the asset to
 * `READY`. Splitting it this way keeps the confirm request fast while still
 * catching uploads that silently failed.
 */

export interface AssetJobPayload {
  assetId: string;
  userId: string;
}

export const ASSET_QUEUE_NAME = "asset-processing";

export class AssetQueue extends BaseQueueService<AssetJobPayload> {
  constructor() {
    super(ASSET_QUEUE_NAME, 4);
  }

  async handler(job: Job<AssetJobPayload>): Promise<void> {
    const { assetId, userId } = job.data;

    const asset = await AssetModel.findById(assetId);
    if (!asset) {
      logger.warn("Asset job references a missing asset", { assetId });
      return;
    }
    if (asset.status === AssetStatus.READY) return; // Idempotent replay.

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
        const thumb = await this.buildImageThumbnail(asset.storagePath, asset.mimeType);
        if (thumb) asset.thumbnailUrl = thumb;
      }

      // A saved project references media by URL, so that URL has to stay valid
      // indefinitely — a signed URL would expire and silently break the
      // project. Publishing the object gives a stable address; the storage key
      // is long and random, so it is not guessable. No-op on the local driver.
      await storage.makePublic?.(asset.storagePath);

      asset.status = AssetStatus.READY;
      asset.error = null;
      await asset.save();

      this.publish(userId, { assetId, status: AssetStatus.READY, url: asset.url, thumbnailUrl: asset.thumbnailUrl });
      logger.info("Asset processed", { assetId, type: asset.type });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Asset processing failed", { assetId, error: message });

      await AssetModel.updateOne(
        { _id: assetId },
        { status: AssetStatus.FAILED, error: "We could not process this file. Please try uploading it again." },
      ).catch(() => {});

      this.publish(userId, { assetId, status: AssetStatus.FAILED });
      throw error;
    }
  }

  /**
   * Downscales an image for grid thumbnails. `sharp` is loaded lazily and a
   * failure is non-fatal: a missing thumbnail is a cosmetic downgrade, not a
   * reason to mark a perfectly good upload broken.
   */
  private async buildImageThumbnail(storagePath: string, mimeType: string): Promise<string | null> {
    if (mimeType === "image/svg+xml" || mimeType === "image/gif") return null;

    try {
      const [{ default: sharp }, storage] = await Promise.all([
        import("sharp") as Promise<{ default: typeof import("sharp") }>,
        Promise.resolve(objectStorage()),
      ]);

      const source = await this.readObject(storagePath);
      if (!source) return null;

      const buffer = await sharp(source)
        .resize(480, 480, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();

      return await storage.putBuffer(`${storagePath}.thumb.webp`, buffer, "image/webp");
    } catch (error) {
      logger.warn("Thumbnail generation skipped", {
        storagePath,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async readObject(storagePath: string): Promise<Buffer | null> {
    const storage = objectStorage();
    if (storage.name === "local") {
      const path = await import("path");
      const { promises: fs } = await import("fs");
      return fs.readFile(path.join(process.cwd(), "uploads", storagePath)).catch(() => null);
    }
    const { bucket } = await import("../configs/gcp.config.js");
    const [buffer] = await bucket.file(storagePath).download();
    return buffer;
  }

  private publish(userId: string, payload: Record<string, unknown>) {
    try {
      publishEvent("ASSET_STATUS", { userId, ...payload } as { userId: string });
    } catch {
      // No socket in worker-only processes; the client refetches on focus.
    }
  }

  public queueProcessing(payload: AssetJobPayload) {
    return this.addJob("process", payload, {
      jobId: `asset_${payload.assetId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: { count: 50 },
    });
  }
}

export default new AssetQueue();
