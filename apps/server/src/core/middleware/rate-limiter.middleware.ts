import { cache } from "@/common/configs/redis.config";
import { RateLimitError } from "@/common/utils/error-utils";
import { NextFunction, Request, Response } from "express";

const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip;
    const key = `rate-limit:${ip}`;

    const LIMIT = 100;
    const WINDOW = 15 * 60;

    const pipeline = cache.multi();

    pipeline.incr(key);
    pipeline.ttl(key);
    const [requests, ttl] = (await pipeline.exec()) as unknown as [
      number,
      number,
    ];

    if (ttl === -1) await cache.expire(key, WINDOW);
    if (requests > LIMIT)
      throw new RateLimitError("Too many requests, try again later.");
    next();
  } catch (error) {
    next();
  }
};

export default rateLimiter;
