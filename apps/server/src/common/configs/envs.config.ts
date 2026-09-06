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
};
