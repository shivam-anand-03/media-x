"use client";

import { closeSocket, createSocket } from "@/lib/socket";
import { useUserInfoQuery } from "@/modules/auth/api/auth-api";
import { isPublicPath } from "@/lib/auth-paths";
import { usePathname } from "next/navigation";
import React, { createContext, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

type SocketContextValue = {
  socket: Socket | null;
  connected: boolean;
};

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // Don't fetch the user (or open a socket) on public/auth screens — the request
  // would 401 and trip the reauth teardown while the user is legitimately
  // signed-out. See isPublicPath for why that otherwise loops.
  const pathname = usePathname();
  const { data: userResponse, isSuccess } = useUserInfoQuery(undefined, {
    skip: isPublicPath(pathname),
  });
  const user = userResponse?.data;

  useEffect(() => {
    // Signed out (or user not resolved yet): tear the socket down completely so
    // no stale, previously-authenticated connection lingers.
    if (!isSuccess || !user?.id) {
      closeSocket();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    const s = createSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    if (s.connected) setConnected(true);

    socketRef.current = s;
    setSocket(s);

    // When the signed-in user changes, fully close the old socket so the next
    // run opens a fresh one that authenticates as the new user — this is what
    // keeps per-user events (KYC notifications, chat) from leaking across
    // accounts in the same browser session.
    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      closeSocket();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.id, isSuccess]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}
