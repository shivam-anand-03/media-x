import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

// Returns the shared socket, creating it if one isn't already open. The
// connection authenticates from the auth cookie during the handshake, so it
// MUST be torn down (see closeSocket) whenever the signed-in user changes —
// otherwise it stays joined to the previous user's server-side room and would
// receive their private events (e.g. KYC notifications).
export function createSocket(): Socket {
  if (socket) return socket;

  socket = io(process.env.NEXT_PUBLIC_WEB_SOCKET_SERVER!, {
    path: "/socket.io",
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 20000,
    transports: ["websocket"],
  });

  return socket;
}

// Fully tears down the shared socket so the next createSocket() opens a brand
// new connection authenticated as whoever is now signed in.
export function closeSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
