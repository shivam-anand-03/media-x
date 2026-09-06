import { LogModel, type Log } from "@/core/models/log.model";

export type CreateLogInput = {
  level: Log["level"];
  message: string;
  context?: string;
  userId?: Log["userId"];
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  meta?: Record<string, unknown>;
  stack?: string;
};

export type ListLogsInput = {
  level?: Log["level"] | Log["level"][];
  userId?: string;
  requestId?: string;
  context?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  search?: string;
  limit?: number;
  skip?: number;
};

class LogService {
  private get logModel() {
    return LogModel as any;
  }

  private buildFilter(query: ListLogsInput = {}) {
    const filter: Record<string, any> = {};

    if (query.level) {
      filter.level = Array.isArray(query.level)
        ? { $in: query.level }
        : query.level;
    }

    if (query.userId) {
      filter.userId = query.userId;
    }

    if (query.requestId) {
      filter.requestId = query.requestId;
    }

    if (query.context) {
      filter.context = query.context;
    }

    if (query.method) {
      filter.method = query.method;
    }

    if (query.path) {
      filter.path = query.path;
    }

    if (query.statusCode !== undefined) {
      filter.statusCode = query.statusCode;
    }

    if (query.search?.trim()) {
      filter.$or = [
        { message: { $regex: query.search.trim(), $options: "i" } },
        { context: { $regex: query.search.trim(), $options: "i" } },
        { path: { $regex: query.search.trim(), $options: "i" } },
      ];
    }

    return filter;
  }

  private normalizeWriteInput(input: CreateLogInput) {
    return {
      ...input,
      meta: input.meta ?? {},
    };
  }

  async writeLog(input: CreateLogInput) {
    return this.logModel.create(this.normalizeWriteInput(input));
  }

  async writeLogs(inputs: CreateLogInput[]) {
    return this.logModel.insertMany(
      inputs.map((input) => this.normalizeWriteInput(input)),
    );
  }

  async getLogById(id: string) {
    return this.logModel.findById(id).lean();
  }

  async listLogs(query: ListLogsInput = {}) {
    const limit = query.limit ?? 100;
    const skip = query.skip ?? 0;

    return this.logModel
      .find(this.buildFilter(query))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async countLogs(query: ListLogsInput = {}) {
    return this.logModel.countDocuments(this.buildFilter(query));
  }
}

export const logService = new LogService();
export default logService;
