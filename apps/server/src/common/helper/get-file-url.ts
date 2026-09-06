import { Request } from "express";
import GCPStorage from "@/common/services/storage.service";
import { envs } from "@/common/configs/envs.config";

export const getFileUrl = async (req: Request): Promise<string | null> => {
  if (!req.file) {
    return null;
  }

  try {
    const result = await GCPStorage.uploadFile(req);

    return `https://storage.googleapis.com/${result.bucket}/${result.filePath}`;
  } catch (error) {
    console.warn(
      "GCPStorage failed, falling back to local file upload path",
      error,
    );

    const serverUrl =
      envs.SERVER_APP_URL || `http://localhost:${envs.PORT || 5030}`;

    return `${serverUrl}/uploads/${req.file.filename}`;
  }
};
