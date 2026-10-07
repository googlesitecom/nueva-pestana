"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  return socket;
}

export function connectSocket(): Socket {
  if (typeof window !== "undefined") {
    (window as unknown as { __axcSocket?: unknown }).__axcSocket = undefined;
  }
  if (socket?.connected) {
    exposeDebug(socket);
    return socket;
  }
  if (socket) {
    socket.connect();
    exposeDebug(socket);
    return socket;
  }
  // Never use PORT in the URL, always use XTransformPort (gateway routing)
  socket = io("/?XTransformPort=3003", {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 12000,
    withCredentials: true,
  });
  exposeDebug(socket);
  return socket;
}

function exposeDebug(s: Socket) {
  if (typeof window !== "undefined") {
    (window as unknown as { __axcSocket?: unknown }).__axcSocket = s;
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
