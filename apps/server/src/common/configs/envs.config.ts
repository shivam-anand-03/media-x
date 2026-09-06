import dotenv from "dotenv";
import path from "path";
import { existsSync } from "fs";
import { version } from "../../../package.json";
import { logger } from "../helper/logger";

const rootEnvPath = path.resolve(__dirname, "../../../.env");

if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
  logger.info("⚙️ ENV LOADED:", rootEnvPath);
} else {
  dotenv.config();
  logger.info("⚙️ Loaded default .env");
}

type Environment = "development" | "production" | "test" | "staging";

export const envs = {
  NODE_ENV: (process.env.NODE_ENV || "development") as Environment,
  PORT: parseInt(process.env.PORT || "5030", 10),
  VERSION: process.env.APP_VERSION || version,

  // APP URLS
  CLIENT_APP_URL: process.env.CLIENT_WEB_APP_URL as string,
  SERVER_APP_URL: process.env.SERVER_APP_URL as string,

  // DATABASE CONFIGS
  MONGODB_URI: process.env.MONGODB_URI as string,

  // GCP CONFIGS
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID as string,
  GCP_BUCKET_NAME: process.env.GCP_BUCKET_NAME as string,
  GCP_KEY_PATH: process.env.GCP_KEY_PATH as string,

  // ---------------------------------------------------------------------
  // Motion Studio
  // ---------------------------------------------------------------------

  /**
   * Which object-storage driver backs asset uploads.
   * `gcs`   — signed-URL uploads straight to the bucket (production).
   * `local` — uploads land in ./uploads and are served from /uploads. The
   *           upload *flow* is identical either way, so nothing downstream
   *           has to care which one is active.
   */
  STORAGE_DRIVER: (process.env.STORAGE_DRIVER || "local") as "gcs" | "local",
  /** Signs the local driver's upload tickets so /uploads is not world-writable. */
  UPLOAD_SIGNING_SECRET:
    process.env.UPLOAD_SIGNING_SECRET || "motion-studio-local-upload-secret",
  /** Minutes an upload ticket stays valid. */
  UPLOAD_URL_TTL_MINUTES: parseInt(process.env.UPLOAD_URL_TTL_MINUTES || "15", 10),

  /** How many videos this process renders at a time. Each render costs a Chrome. */
  RENDER_CONCURRENCY: parseInt(process.env.RENDER_CONCURRENCY || "1", 10),
  /** Hard ceiling on a single render, in milliseconds. */
  RENDER_TIMEOUT_MS: parseInt(process.env.RENDER_TIMEOUT_MS || "600000", 10),
  /** Absolute path to a Chrome/Chromium binary for Remotion, if not bundled. */
  REMOTION_BROWSER_EXECUTABLE: process.env.REMOTION_BROWSER_EXECUTABLE || undefined,

  // AI ADVERTISEMENT GENERATION
  OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY as string,
  PINE_CONE_API_KEY: process.env.PINE_CONE_API_KEY as string,
  PINE_CONE_INDEX: process.env.PINE_CONE_INDEX as string,
  /** Model used by the AI advertisement generator. */
  AI_MODEL: process.env.AI_MODEL || "gpt-4o-mini",
};
