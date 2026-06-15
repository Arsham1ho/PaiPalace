import { io, type Socket } from "socket.io-client";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) socket = io(BASE, { transports: ["websocket", "polling"] });
  return socket;
}
