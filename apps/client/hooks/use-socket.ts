"use client";

import { SocketContext } from "@/components/providers/socket-provider";
import { useContext } from "react";

export function useSocket() {
  const ctx = useContext(SocketContext);

  if (!ctx) {
    throw new Error("useSocket must be used inside SocketProvider");
  }

  return ctx;
}
