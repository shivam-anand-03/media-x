import type { BaseQueueService } from "@/common/services/base-queue.service";
import { logger } from "../helper/logger";

/**
 * Generic registry of queue services.
 *
 * It has no knowledge of any concrete queue: services register themselves from
 * `BaseQueueService`'s constructor. Adding a new queue therefore never requires
 * editing this class — it is closed for modification, open for extension
 * (Open/Closed Principle). The concrete queues are wired up in `./index.ts`.
 */
class QueueManager {
  private static instance: QueueManager;

  private queues = new Map<string, BaseQueueService>();

  private constructor() {}

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /** Register a queue under its `queueName`. Called by BaseQueueService. */
  public register(queue: BaseQueueService): void {
    if (this.queues.has(queue.queueName)) return;
    this.queues.set(queue.queueName, queue);
    logger.info(`📦 Queue registered: ${queue.queueName}`);
  }

  public startWorkers() {
    this.queues.forEach((q) => q.startWorker());
    logger.info("⚙️ Workers active");
  }

  public async shutdownAll() {
    logger.info("🛑 Shutting down all queues...");
    await Promise.all(
      Array.from(this.queues.values()).map((q) => q.shutdown()),
    );
    this.queues.clear();
  }

  public get<T extends BaseQueueService = BaseQueueService>(key: string): T {
    const q = this.queues.get(key);
    if (!q) throw new Error(`Queue ${key} not found`);
    return q as T;
  }
}

export const queueManager = QueueManager.getInstance();

export const startAllQueueWorkers = () => queueManager.startWorkers();

export const stopAllWorkers = () => queueManager.shutdownAll();
