import Redis from "ioredis";
import { envs } from "./envs.config";

const baseConfig = {
  host: envs.REDIS_HOST,
  port: Number(envs.REDIS_PORT),
  password: envs.REDIS_PASSWORD,
};

export const queueConnection = new Redis({
  ...baseConfig,
  db: 5,
  maxRetriesPerRequest: null,
});

export const cache = new Redis({
  ...baseConfig,
  db: 0,
});

export const redisPub = new Redis({
  ...baseConfig,
  db: 0,
});

export const redisSub = new Redis({
  ...baseConfig,
  db: 0,
});
