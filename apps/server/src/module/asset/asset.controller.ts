import { Request, Response } from "express";
import { Types } from "mongoose";
import { confirmUploadSchema, listAssetsSchema, requestUploadSchema, type AssetKind } from "@workspace/motion";
import { ApiResponse, AsyncHandler } from "@/common/utils/api-utils";
import { NotFoundError, ValidationError } from "@/common/utils/error-utils";
import { logger } from "@/common/helper/logger";
import { AssetModel, AssetStatus, AssetType } from "@/core/models";
import {
  assertUploadAllowed,
  buildStoragePath,
  objectStorage,
  verifyLocalUpload,
  MEDIA_PREFIX,
} from "@/common/services/object-storage.service";
import { startAssetProcessing } from "@/common/services/asset-processor.service";
import { ProjectService } from "../project/project.service";

/**
 * Asset upload (§35).
 *
 * Three steps, so bytes never pass through this process:
 *   1. POST /assets/upload-url  → validate policy, hand back a signed ticket
 *   2. PUT  <uploadUrl>         → browser uploads straight to storage
 *   3. POST /assets/confirm     → create the Asset row, start processing
 */
class AssetController {
  /** POST /v1/assets/upload-url */
  requestUploadHandler = AsyncHandler(async (req: Request, res: Response) => {
    const body = requestUploadSchema.parse(req.body);

    // Policy first — an oversized or wrong-typed file never gets a key at all.
    assertUploadAllowed(body.kind, body.mimeType, body.size);

    if (body.projectId) {
      await ProjectService.assertExists(body.projectId);
    }

    const storagePath = buildStoragePath(body.kind, body.filename);
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
    const body = confirmUploadSchema.parse(req.body);

    assertUploadAllowed(body.kind, body.mimeType, body.size);

    // Only keys this API issued may be confirmed, so a client cannot register
    // an export — or anything outside the media tree — as its own asset.
    if (!body.storagePath.startsWith(`${MEDIA_PREFIX}/`)) {
      throw new ValidationError("That upload path is not valid.");
    }

    if (body.projectId) {
      await ProjectService.assertExists(body.projectId);
    }

    const storage = objectStorage();
    const asset = await AssetModel.create({
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
    // place the asset immediately. The client polls the asset until it settles.
    startAssetProcessing(asset.id);

    res.status(201).json(new ApiResponse("Upload complete.", asset.toJSON()));
  });

  /** GET /v1/assets */
  listAssetsHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { page, limit, kind, projectId, search } = listAssetsSchema.parse(req.query);

    const filter: Record<string, unknown> = {};
    if (kind) filter.type = kind;
    if (projectId) {
      await ProjectService.assertExists(projectId);
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
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) throw new ValidationError("Invalid asset id.");

    const asset = await AssetModel.findById(id);
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
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) throw new ValidationError("Invalid asset id.");

    const asset = await AssetModel.findById(id).lean({ virtuals: true });

    if (!asset) throw new NotFoundError("Asset not found.");
    res.status(200).json(new ApiResponse("Asset loaded.", { ...asset, id: (asset as any)._id?.toString() }));
  });
}

export default new AssetController();
export type { AssetKind };
