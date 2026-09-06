import Transport from "winston-transport";
import { logService, type CreateLogInput } from "@/core/services/log.service";

// Reserved keys that map onto dedicated Log columns. Everything else on the info object is folded into `meta` so nothing is lost.
const RESERVED = new Set([
  "level",
  "message",
  "timestamp",
  "stack",
  "context",
  "requestId",
  "method",
  "path",
  "url",
  "statusCode",
  "status",
  "persist",
]);

// A Winston transport that persists logs to MongoDB. It is non-blocking and swallows persistence failures.
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
      requestId: info.requestId,
      method: info.method,
      path: info.path ?? info.url,
      statusCode: info.statusCode ?? info.status,
      stack: info.stack,
      meta,
    };
  }

  private async handle(info: any): Promise<void> {
    try {
      await logService.writeLog(this.toInput(info));
    } catch {
      // Logging must never take the process down with it.
    }
  }
}
