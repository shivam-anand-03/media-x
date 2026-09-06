import { Request, Response } from "express";
import { Types } from "mongoose";
import { confirmUploadSchema, listAssetsSchema, requestUploadSchema, type AssetKind } from "@workspace/motion";
import { ApiResponse, AsyncHandler } from "@/common/utils/api-utils";
import { NotFoundError, ValidationError } from "@/common/utils/error-utils";
import { getAuth } from "@/common/helper/global";
import { logger } from "@/common/helper/logger";
import { AssetModel, AssetStatus, AssetType } from "@/core/models";
import {
  assertUploadAllowed,
  buildStoragePath,
  objectStorage,
  verifyLocalUpload,
} from "@/common/services/object-storage.service";
import { queueManager } from "@/common/queue/queue-manager";
import { AssetQueue, ASSET_QUEUE_NAME } from "@/common/queue/asset.queue";
import { ProjectService } from "../project/project.service";

/**
 * Asset upload (§35).
 *
 * Three steps, so bytes never pass through this process:
 *   1. POST /assets/upload-url  → validate policy, hand back a signed ticket
 *   2. PUT  <uploadUrl>         → browser uploads straight to storage
 *   3. POST /assets/confirm     → create the Asset row, queue processing
 */
class AssetController {
  private get assetQueue(): AssetQueue {
    return queueManager.get<AssetQueue>(ASSET_QUEUE_NAME);
  }

  /** POST /v1/assets/upload-url */
  requestUploadHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const body = requestUploadSchema.parse(req.body);

    // Policy first — an oversized or wrong-typed file never gets a key at all.
    assertUploadAllowed(body.kind, body.mimeType, body.size);

    if (body.projectId) {
      await ProjectService.assertOwnership(body.projectId, userId);
    }

    const storagePath = buildStoragePath(userId, body.kind, body.filename);
    const ticket = await objectStorage().createUploadTicket({
      storagePath,
      mimeType: body.mimeType,
      size: body.size,
    });

    res.status(200).json(new ApiResponse("Upload ready.", ticket));
  });

  /**
   * PUT /v1/assets/upload — the local driver's upload target.
   *
   * Only reachable with a valid HMAC ticket; without the signature check this
   * would be an unauthenticated write endpoint. Unused when STORAGE_DRIVER=gcs,
   * where the browser PUTs to Google directly.
   */
  localUploadHandler = AsyncHandler(async (req: Request, res: Response) => {
    const storage = objectStorage();
    if (storage.name !== "local") {
      throw new ValidationError("Direct upload is not enabled on this deployment.");
    }

    const { path: storagePath, mimeType, size, expires, signature } = req.query as Record<string, string>;
    if (!storagePath || !mimeType || !size || !expires || !signature) {
      throw new ValidationError("Malformed upload ticket.");
    }

    verifyLocalUpload(storagePath, mimeType, Number(size), Number(expires), signature);

    const body = req.body;
    if (!Buffer.isBuffer(body)) {
      throw new ValidationError("Upload body must be raw bytes.");
    }
    // The ticket is bound to a byte count; honour it so a small ticket can't
    // be replayed to store a huge file.
    if (body.byteLength > Number(size)) {
      throw new ValidationError("Uploaded file is larger than the ticket allows.");
    }

    await storage.putBuffer(storagePath, body, mimeType);
    res.status(200).json(new ApiResponse("Uploaded.", { storagePath }));
  });

  /** POST /v1/assets/confirm */
  confirmUploadHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const body = confirmUploadSchema.parse(req.body);

    assertUploadAllowed(body.kind, body.mimeType, body.size);

    // A user may only confirm a key inside their own prefix — otherwise one
    // account could claim another's object by guessing its path.
    if (!body.storagePath.startsWith(`users/${userId}/`)) {
      throw new ValidationError("That upload does not belong to you.");
    }

    if (body.projectId) {
      await ProjectService.assertOwnership(body.projectId, userId);
    }

    const storage = objectStorage();
    const asset = await AssetModel.create({
      userId: new Types.ObjectId(userId),
      projectId: body.projectId ? new Types.ObjectId(body.projectId) : null,
      type: body.kind as AssetType,
      status: AssetStatus.PENDING,
      filename: body.filename,
      mimeType: body.mimeType,
      size: body.size,
      storagePath: body.storagePath,
      url: storage.publicUrl(body.storagePath),
      metadata: body.metadata ?? {},
    });

    // Verification and thumbnailing happen off the request so the editor can
    // place the asset immediately.
    await this.assetQueue.queueProcessing({ assetId: asset.id, userId }).catch((error) => {
      logger.warn("Could not queue asset processing; marking ready optimistically", {
        assetId: asset.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return AssetModel.updateOne({ _id: asset._id }, { status: AssetStatus.READY });
    });

    res.status(201).json(new ApiResponse("Upload complete.", asset.toJSON()));
  });

  /** GET /v1/assets */
  listAssetsHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const { page, limit, kind, projectId, search } = listAssetsSchema.parse(req.query);

    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (kind) filter.type = kind;
    if (projectId) {
      await ProjectService.assertOwnership(projectId, userId);
      filter.projectId = new Types.ObjectId(projectId);
    }
    if (search) {
      filter.filename = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    const [items, total] = await Promise.all([
      AssetModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean({ virtuals: true }),
      AssetModel.countDocuments(filter),
    ]);

    res.status(200).json(
      new ApiResponse("Assets loaded.", {
        items: items.map((a: any) => ({ ...a, id: a._id?.toString() ?? a.id })),
        page,
        limit,
        total,
        hasMore: page * limit < total,
      }),
    );
  });

  /** DELETE /v1/assets/:id */
  deleteAssetHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) throw new ValidationError("Invalid asset id.");

    const asset = await AssetModel.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) });
    if (!asset) throw new NotFoundError("Asset not found.");

    await AssetModel.deleteOne({ _id: asset._id });
    // Storage cleanup is best-effort: a stranded object is far less bad than
    // failing the user's delete.
    objectStorage()
      .delete(asset.storagePath)
      .catch((error) => logger.warn("Could not remove stored object", { storagePath: asset.storagePath, error }));

    res.status(200).json(new ApiResponse("Asset deleted."));
  });

  /** GET /v1/assets/:id — used to poll a PENDING asset until it is READY. */
  getAssetHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) throw new ValidationError("Invalid asset id.");

    const asset = await AssetModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    }).lean({ virtuals: true });

    if (!asset) throw new NotFoundError("Asset not found.");
    res.status(200).json(new ApiResponse("Asset loaded.", { ...asset, id: (asset as any)._id?.toString() }));
  });
}

export default new AssetController();
export type { AssetKind };
