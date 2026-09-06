import { EventEmitter } from "events";

// Type for log entries that are streamed to connected listeners.
export type StreamedLog = {
  _id?: string;
  level: string;
  message: string;
  context?: string;
  userId?: string | null;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  meta?: Record<string, unknown>;
  stack?: string;
  createdAt: string;
};

// EventEmitter that streams log entries to connected listeners. The `MongoLogTransport` pushes every log entry onto this stream after it has been persisted to MongoDB (or if persistence fails, the entry is still pushed so the live view keeps working).
class LogStream extends EventEmitter {}

// Export a singleton instance of LogStream and a constant for the event name used to emit log entries.
export const logStream = new LogStream();

export const LOG_STREAM_EVENT = "log" as const;
