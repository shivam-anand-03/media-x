import { bucket } from "@/common/configs/gcp.config";
import { ValidationError } from "@/common/utils/error-utils";
import { Request } from "express";
import { createReadStream, promises as fs } from "fs";

export default class GCPStorage {
  private static sanitizeFileName(name: string) {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.-]/g, "");
  }

  public static async uploadFile(req: Request): Promise<{
    bucket: string;
    filePath: string;
    mimeType: string;
  }> {
    if (!req.file?.path) {
      throw new ValidationError("File not found");
    }

    const multerFile = req.file;
    const localPath = multerFile.path;

    const MAX_SIZE = 60 * 1024 * 1024;

    const stats = await fs.stat(localPath);

    if (stats.size > MAX_SIZE) {
      await fs.unlink(localPath);
      throw new ValidationError("File size exceeds 60MB limit");
    }

    const safeName = this.sanitizeFileName(multerFile.originalname);
    const uniqueName = `${Date.now()}-${safeName}`;

    const destination = `uploads/${uniqueName}`;
    const gcsFile = bucket.file(destination);

    try {
      await new Promise<void>((resolve, reject) => {
        createReadStream(localPath)
          .pipe(
            gcsFile.createWriteStream({
              resumable: false,
              contentType: multerFile.mimetype || "application/octet-stream",
            }),
          )
          .on("finish", resolve)
          .on("error", reject);
      });
    } finally {
      await fs.unlink(localPath).catch(() => {});
    }

    return {
      bucket: bucket.name,
      filePath: destination,
      mimeType: multerFile.mimetype || "application/octet-stream",
    };
  }
}
