import { envs } from "@/common/configs/envs.config";
import { logger } from "@/common/helper/logger";
import { Pinecone } from "@pinecone-database/pinecone";
import { IDatabase } from "./types";

export class VectorDatabase implements IDatabase {
  private readonly client: Pinecone;
  private readonly indexName: string;

  constructor(indexName = envs.PINE_CONE_INDEX) {
    this.indexName = indexName;

    this.client = new Pinecone({
      apiKey: envs.PINE_CONE_API_KEY,
    });
  }

  async connect(): Promise<void> {
    logger.info("Pinecone client initialized");
  }

  async disconnect(): Promise<void> {
    logger.info("Pinecone client closed");
  }

  getIndex(namespace?: string) {
    return this.client.index(this.indexName).namespace(namespace ?? "");
  }

  getClient(): Pinecone {
    return this.client;
  }
}
