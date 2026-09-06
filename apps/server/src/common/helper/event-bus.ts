import { SocketService } from "@/common/services/socket.service";
import http from "http";

let socketService: SocketService | null = null;

export function initEventBus(server: http.Server) {
  if (socketService) return;

  socketService = SocketService.getInstance(server);
  socketService.init();
}

export function publishEvent<T extends { userId: string }>(
  type: string,
  payload: T,
) {
  if (!socketService) {
    throw new Error("EventBus not initialized");
  }

  return socketService.publish(type as any, payload);
}
