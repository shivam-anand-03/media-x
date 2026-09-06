import { Queue, Worker, QueueEvents, Job, JobsOptions } from "bullmq";
import { queueConnection } from "@/common/configs/redis.config";
import { queueManager } from "@/common/queue/queue-manager";
import { logger } from "../helper/logger";
import Redis from "ioredis";

export abstract class BaseQueueService<T = any> {
  protected queue: Queue;
  protected worker?: Worker;
  protected events: QueueEvents;
  private workerConnection?: Redis;
  private eventsConnection: Redis;
  private isShuttingDown = false;

  constructor(
    public readonly queueName: string,
    protected concurrency = 1,
    private connection: Redis = queueConnection,
  ) {
    this.queue = new Queue(queueName, {
      connection: this.connection,
      prefix: "bull",
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: { count: 3, age: 300 },
      },
    });

    this.eventsConnection = this.connection.duplicate();
    this.events = new QueueEvents(queueName, {
      connection: this.eventsConnection,
      prefix: "bull",
    });

    // Self-register so the QueueManager never needs to know about concrete
    // queues — extending the system means adding a subclass, not editing the
    // manager (Open/Closed Principle).
    queueManager.register(this);
  }

  // Subclasses must implement this method to handle jobs of type T
  abstract handler(job: Job<T>): Promise<void>;

  public startWorker() {
    if (this.worker) return;

    // Dedicated blocking connection for the worker (see constructor note).
    this.workerConnection = this.connection.duplicate();
    this.worker = new Worker<T>(this.queueName, (job) => this.handler(job), {
      connection: this.workerConnection,
      prefix: "bull",
      concurrency: this.concurrency,
      lockDuration: 60000, // embedding + Pinecone upsert can exceed 30s
      maxStalledCount: 3, // tolerate the occasional missed lock renewal
      autorun: true,
    });

    this.setupLogging();
  }

  public get instance(): Queue {
    return this.queue;
  }

  private setupLogging() {
    if (!this.worker) return;

    this.worker.on("completed", (job) =>
      logger.info(`✅ [${this.queueName}] Completed: ${job.id}`),
    );
    this.worker.on("failed", (job, err) =>
      logger.error(`❌ [${this.queueName}] Failed: ${job?.id}: ${err.message}`),
    );
    this.worker.on("error", (err) =>
      logger.error(`🔥 [${this.queueName}] Critical Worker Error`, err),
    );

    this.events.on("stalled", ({ jobId }) =>
      logger.warn(`⚠️ [${this.queueName}] Stalled: ${jobId}`),
    );
  }

  async addJob(name: string, data: T, opts?: JobsOptions) {
    return this.queue.add(name, data, opts);
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    await Promise.all([
      this.worker?.close(),
      this.queue.close(),
      this.events.close(),
    ]);
    await Promise.all([
      this.workerConnection?.quit(),
      this.eventsConnection.quit(),
    ]);
    logger.info(`🛑 [${this.queueName}] Service offline`);
  }
}
