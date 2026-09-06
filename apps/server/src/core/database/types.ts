export * from "../models";

export interface IDatabase {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
