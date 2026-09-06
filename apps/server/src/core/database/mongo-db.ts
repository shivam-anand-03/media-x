import { envs } from "@/common/configs/envs.config";
import { logger } from "@/common/helper/logger";
import { IDatabase } from "./types";
import mongoose, { Mongoose } from "mongoose";

export class MongoDatabase implements IDatabase {
  private readonly mongo: Mongoose;
  private connectionPromise: Promise<Mongoose> | null = null;

  constructor() {
    this.mongo = mongoose;
  }

  get client(): Mongoose {
    return this.mongo;
  }

  async connect(): Promise<void> {
    if (this.mongo.connection.readyState === 1) {
      return;
    }
    if (this.connectionPromise) {
      await this.connectionPromise;
      return;
    }

    const mongoUri = envs.MONGODB_URI?.trim();
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not set");
    }

    logger.info("Connecting to MongoDB");

    this.connectionPromise = this.mongo.connect(mongoUri, {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
    });
    try {
      await this.connectionPromise;
      logger.info("MongoDB connected successfully");
    } catch (error) {
      logger.error("MongoDB connection failed", { error });
      throw error;
    } finally {
      this.connectionPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.mongo.connection.readyState !== 0) {
      await this.mongo.disconnect();
      logger.info("MongoDB disconnected");
    }
  }
}

export type MongoDb = Mongoose;
