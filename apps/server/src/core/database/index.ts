import { MongoDatabase } from "./mongo-db";
import { VectorDatabase } from "./vector-db";

export const vectorDB = new VectorDatabase();
export const mongoDB = new MongoDatabase();
