import { Storage } from "@google-cloud/storage";
import { envs } from "./envs.config";

export const storage = new Storage({
  keyFilename: envs.GCP_KEY_PATH,
  projectId: envs.GCP_PROJECT_ID,
});

export const bucket = storage.bucket(envs.GCP_BUCKET_NAME);
