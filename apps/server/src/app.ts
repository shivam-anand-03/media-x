import cors from "cors";
import express, { Application } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { routes } from "@/core/routes/root.route";
import { envs } from "@/common/configs/envs.config";
import rateLimiter from "./core/middleware/rate-limiter.middleware";
import { errorMiddleware } from "@/core/middleware/error.middleware";
import { requestLogger } from "./core/middleware/request-logger.middleware";
export class App {
  private readonly app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
  }

  private initializeMiddlewares(): void {
    this.app.use(helmet());
    this.app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

    this.app.use(rateLimiter);

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());

    // CORS must be registered *before* the static mount below. The editor loads
    // uploaded media with crossOrigin="anonymous" (so the canvas stays untainted
    // and thumbnails can be captured), which means the browser rejects any
    // response without an Access-Control-Allow-Origin header — served files
    // included.
    this.app.use(
      cors({
        origin: [
          envs.CLIENT_APP_URL,
          envs.SERVER_APP_URL,
          envs.ADMIN_WEB_APP_URL,
          "*",
        ],
        credentials: true,
      }),
    );

    this.app.use(
      "/uploads",
      express.static(path.join(process.cwd(), "uploads"), {
        // Media is content-addressed by a random key, so it can be cached hard.
        maxAge: "7d",
        setHeaders: (res) => {
          // Lets <video>/<audio> seek instead of re-downloading from the start.
          res.setHeader("Accept-Ranges", "bytes");
        },
      }),
    );

    this.app.use(requestLogger);
  }

  private initializeRoutes(): void {
    this.app.get("/", (_, res) => {
      const now = new Date();

      res.status(200).json({
        message: "EssentoLabs API server is running",
        timestamp: now.toISOString(),
        date: now.toLocaleDateString("en-IN"),
        time: now.toLocaleTimeString("en-IN"),
      });
    });

    this.app.get("/health", (_, res) => {
      res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    routes.forEach((route) => {
      const fullPath = `/v1/${route.prefix}`;
      this.app.use(fullPath, route.route);
    });

    this.app.use(errorMiddleware);
  }

  public getApp(): Application {
    return this.app;
  }
}

export const app = new App().getApp();
