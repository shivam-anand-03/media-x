require("module-alias").addAliases({
  "@": __dirname,
});

import http, { Server as HttpServer } from "http";
import { envs } from "@/common/configs/envs.config";
import { logger } from "@/common/helper/logger";
import { app } from "@/app";
import { mongoDB as mongoDatabase, vectorDB } from "@/core/database";
import { seedTemplates } from "@/module/template/template.controller";
import { objectStorage } from "@/common/services/object-storage.service";
import { drainRenders, reconcileInterruptedJobs } from "@/renderer/render-runner";

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

      await this.mongoDB.connect();

      await this.vector.connect();

      // Idempotent upsert of the bundled template library, so a fresh database
      // never opens on an empty Templates page.
      await seedTemplates();

      // Renders live in this process, so anything still marked running belongs
      // to a process that no longer exists. Fail those rows now so the user
      // gets a retry button instead of a bar frozen mid-render.
      await reconcileInterruptedJobs();

      // Storage is only exercised on upload and export, both of which happen
      // long after boot — so check it now, while someone is still looking at
      // the logs. A failure here is loud but non-fatal: the rest of the app
      // works fine without uploads.
      const storage = objectStorage();
      const writable = await storage.verifyWritable();
      if (writable.ok) {
        logger.info(`🗄️  Storage ready (${storage.name})`);
      } else {
        logger.error(
          `🗄️  Storage driver "${storage.name}" cannot write — uploads and exports will fail: ${writable.reason}`,
        );
      }

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

      // Give any render in progress a short window to finish writing its row.
      await drainRenders();

      // Close resources in parallel; a failure in one shouldn't block others
      const results = await Promise.allSettled([
        this.mongoDB.disconnect(),
        this.vector.disconnect(),
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
