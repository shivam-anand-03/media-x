require("module-alias").addAliases({
  "@": __dirname,
});

import http, { Server as HttpServer } from "http";
import { envs } from "@/common/configs/envs.config";
import { cache } from "@/common/configs/redis.config";
import { startAllQueueWorkers, stopAllWorkers } from "@/common/queue";
import { logger } from "@/common/helper/logger";
import { initEventBus } from "@/common/helper/event-bus";
import { app } from "@/app";
import { mongoDB as mongoDatabase, vectorDB } from "@/core/database";
import { seedTemplates } from "@/module/template/template.controller";

class Server {
  private server: HttpServer;
  private shuttingDown = false;

  constructor(
    private readonly port: number,
    private readonly vector = vectorDB,
    private readonly mongoDB = mongoDatabase,
  ) {
    this.server = http.createServer(app);
  }

  async bootstrap(): Promise<void> {
    try {
      // Fail fast if the port is taken or listen errors out
      this.server.on("error", (error) => {
        logger.error("HTTP server error", { error });
        process.exit(1);
      });

      await cache.ping();
      logger.info("Redis connected");

      await this.mongoDB.connect();

      await this.vector.connect();

      // Idempotent upsert of the bundled template library, so a fresh database
      // never opens on an empty Templates page.
      await seedTemplates();

      startAllQueueWorkers();
      logger.info("Queue workers started");

      initEventBus(this.server);
      logger.info("Event bus initialized");

      await new Promise<void>((resolve) =>
        this.server.listen(this.port, resolve),
      );
      logger.info("Server started", {
        port: this.port,
        env: envs.NODE_ENV,
        url: `http://localhost:${this.port}`,
      });
    } catch (error) {
      logger.error("Fatal startup error", { error });
      process.exit(1);
    }
  }

  async gracefulShutdown(signal: string): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    logger.warn("Graceful shutdown initiated", { signal });

    // Hard deadline: if cleanup hangs, force-exit
    const killTimer = setTimeout(() => {
      logger.error("Force exiting after shutdown timeout");
      process.exit(1);
    }, 15_000);
    killTimer.unref();

    try {
      // Stop accepting new connections, wait for in-flight requests
      await new Promise<void>((resolve, reject) =>
        this.server.close((err) => (err ? reject(err) : resolve())),
      );
      logger.info("HTTP server closed");

      await stopAllWorkers();
      logger.info("Queue workers stopped");

      // Close resources in parallel; a failure in one shouldn't block others
      const results = await Promise.allSettled([
        this.mongoDB.disconnect(),
        this.vector.disconnect(),
        cache.quit(),
      ]);
      for (const r of results) {
        if (r.status === "rejected") {
          logger.error("Error closing resource", { error: r.reason });
        }
      }
      logger.info("All resources closed");

      process.exit(0);
    } catch (error) {
      logger.error("Error during graceful shutdown", { error });
      process.exit(1);
    }
  }
}

const server = new Server(Number(envs.PORT) || 3000);
void server.bootstrap();

process.on("SIGTERM", () => void server.gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void server.gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error });
  void server.gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
  void server.gracefulShutdown("unhandledRejection");
});
