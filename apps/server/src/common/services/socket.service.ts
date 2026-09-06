import { Server } from "socket.io";
import http from "http";
import * as cookie from "cookie";
import { Role, UserModel } from "@/core/models";
import { envs } from "../configs/envs.config";
import { redisPub, redisSub } from "../configs/redis.config";
import { logger } from "../helper/logger";
import {
  logStream,
  LOG_STREAM_EVENT,
  type StreamedLog,
} from "../helper/log-stream";
import { PubSub } from "./pubsub.service";
import { AuthUtils } from "../utils/auth-utils";

const SOCKET_EVENTS = {
  SERVER_LOG: "SERVER_LOG",
};

// Shared room that every admin socket joins so server logs can be fanned out to
// all of them at once. Safe as a fixed name: real user rooms are keyed by their
// userId, which never collides with this literal.
const ADMIN_ROOM = "admins";

type AppEventPayload = {
  type: string;
  userId: string;
  payload: any;
};

export class SocketService {
  private io: Server;
  private pubsub: PubSub;
  private static instance: SocketService;

  public static getInstance(server: http.Server): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService(server);
    }
    return SocketService.instance;
  }

  constructor(server: http.Server) {
    this.io = new Server(server, {
      path: "/socket.io",
      cors: {
        origin: [envs.CLIENT_APP_URL, envs.ADMIN_WEB_APP_URL].filter(Boolean),
        credentials: true,
      },
      maxHttpBufferSize: 1e8,
    });

    this.pubsub = new PubSub(redisPub, redisSub);
  }

  init() {
    this.registerAuthMiddleware();
    this.setupSocketListeners();
    this.setupRedisListeners();
    this.setupLogStream();
  }

  private setupLogStream() {
    logStream.on(LOG_STREAM_EVENT, (log: StreamedLog) => {
      this.pubsub
        .publish("app:events", {
          type: SOCKET_EVENTS.SERVER_LOG,
          userId: ADMIN_ROOM,
          payload: log,
        })
        .catch(() => {
          // Swallow: a failed relay must never cascade back into the logger.
        });
    });
  }

  private registerAuthMiddleware() {
    this.io.use((socket, next) => {
      try {
        const rawCookie = socket.handshake.headers.cookie;

        if (!rawCookie) {
          return next(new Error("No cookies sent"));
        }

        const cookies = cookie.parse(rawCookie);

        const accessToken = cookies["access_token"];

        if (!accessToken) {
          return next(new Error("No access token"));
        }

        const { userId } = AuthUtils.verifyAccessToken(accessToken);

        if (!userId) {
          return next(new Error("Invalid token"));
        }

        socket.data.userId = userId;

        next();
      } catch (err) {
        next(new Error("Unauthorized"));
      }
    });
  }

  private setupSocketListeners() {
    this.io.on("connection", async (socket) => {
      const userId = socket.data.userId;

      socket.join(userId);

      try {
        const dbUser = await UserModel.findById(userId).select("role").lean();
        if (dbUser?.role === Role.ADMIN) {
          socket.join(ADMIN_ROOM);
        }
      } catch (err) {
        logger.error("Failed to resolve role for socket connection", err);
      }

      logger.info(`👤 User ${userId} connected`);

      socket.on("disconnect", () => {
        logger.info(`❌ User ${userId} disconnected`);
      });
    });
  }

  private setupRedisListeners() {
    this.pubsub.subscribe("app:events", (event: AppEventPayload) => {
      const { type, userId, payload } = event;
      if (!userId || !type) return;

      this.io.to(userId).emit(type, payload);
    });
  }

  async publish(
    eventType: keyof typeof SOCKET_EVENTS,
    payload: { [key: string]: any },
  ) {
    await this.pubsub.publish("app:events", {
      type: eventType,
      userId: payload.userId,
      payload,
    });
  }
}
