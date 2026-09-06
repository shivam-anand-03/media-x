import Transport from "winston-transport";
import { logService, type CreateLogInput } from "@/core/services/log.service";
import { logStream, LOG_STREAM_EVENT, type StreamedLog } from "./log-stream";

// Reserved keys that map onto dedicated Log columns. Everything else on the info object is folded into `meta` so nothing is lost.
const RESERVED = new Set([
  "level",
  "message",
  "timestamp",
  "stack",
  "context",
  "userId",
  "requestId",
  "method",
  "path",
  "url",
  "statusCode",
  "status",
  "persist",
]);

// A Winston transport that persists logs to MongoDB and streams them to any connected listeners. The transport is designed to be non-blocking and resilient to failures in the persistence layer or the streaming layer.
export class MongoLogTransport extends Transport {
  log(info: any, callback: () => void): void {
    setImmediate(() => this.emit("logged", info));
    if (info.persist !== false) {
      void this.handle(info);
    }
    callback();
  }

  private toInput(info: any): CreateLogInput {
    const meta: Record<string, unknown> = {};
    for (const key of Object.keys(info)) {
      if (!RESERVED.has(key)) meta[key] = info[key];
    }

    return {
      level: info.level,
      message:
        typeof info.message === "string"
          ? info.message
          : String(info.message ?? ""),
      context: info.context,
      userId: info.userId,
      requestId: info.requestId,
      method: info.method,
      path: info.path ?? info.url,
      statusCode: info.statusCode ?? info.status,
      stack: info.stack,
      meta,
    };
  }

  private async handle(info: any): Promise<void> {
    const input = this.toInput(info);

    let streamed: StreamedLog = {
      ...input,
      createdAt: new Date().toISOString(),
    };

    try {
      const doc = await logService.writeLog(input);
      streamed = JSON.parse(JSON.stringify(doc)) as StreamedLog;
    } catch {}

    try {
      logStream.emit(LOG_STREAM_EVENT, streamed);
    } catch {}
  }
}
