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
  ADMIN_WEB_APP_URL: process.env.ADMIN_WEB_APP_URL as string,

  // TOKEN SECRETS
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET as string,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET as string,

  // PASSWORD RESET SECRET
  RESET_SECRET: process.env.RESET_SECRET as string,

  // DATABASE CONFIGS
  MONGODB_URI: process.env.MONGODB_URI as string,

  // GCP CONFIGS
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID as string,
  GCP_BUCKET_NAME: process.env.GCP_BUCKET_NAME as string,
  GCP_KEY_PATH: process.env.GCP_KEY_PATH as string,

  // EMAIL CONFIGS
  EMAIL_SERVICE: process.env.EMAIL_SERVICE as string,
  EMAIL_HOST: process.env.EMAIL_HOST as string,
  EMAIL_PORT: process.env.EMAIL_PORT as string,
  EMAIL_USER: process.env.EMAIL_USER as string,
  EMAIL_PASS: process.env.EMAIL_PASS as string,
  EMAIL_FROM: process.env.EMAIL_FROM as string,

  // REDIS CONFIGS
  REDIS_HOST: process.env.REDIS_HOST as string,
  REDIS_PORT: process.env.REDIS_PORT as string,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD as string,

  OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY as string,
  PINE_CONE_API_KEY: process.env.PINE_CONE_API_KEY as string,
  PINE_CONE_INDEX: process.env.PINE_CONE_INDEX as string,

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
    (process.env.UPLOAD_SIGNING_SECRET as string) ||
    (process.env.ACCESS_TOKEN_SECRET as string),
  /** Minutes an upload ticket stays valid. */
  UPLOAD_URL_TTL_MINUTES: parseInt(process.env.UPLOAD_URL_TTL_MINUTES || "15", 10),

  /** Set false on API-only instances so they never pick up render jobs. */
  ENABLE_RENDER_WORKER: process.env.ENABLE_RENDER_WORKER !== "false",
  /** How many videos one instance renders at a time. */
  RENDER_CONCURRENCY: parseInt(process.env.RENDER_CONCURRENCY || "1", 10),
  /** Hard ceiling on a single render, in milliseconds. */
  RENDER_TIMEOUT_MS: parseInt(process.env.RENDER_TIMEOUT_MS || "600000", 10),
  /** Absolute path to a Chrome/Chromium binary for Remotion, if not bundled. */
  REMOTION_BROWSER_EXECUTABLE: process.env.REMOTION_BROWSER_EXECUTABLE || undefined,

  /** Model used by the AI advertisement generator. */
  AI_MODEL: process.env.AI_MODEL || "gpt-4o-mini",
};
