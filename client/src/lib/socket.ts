import { io, type Socket } from "socket.io-client";

// Same-origin in production (empty base → Socket.IO connects to window.origin);
// local server in dev. Override with VITE_API_URL for a separate backend host.
const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:4000" : "");

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) socket = io(BASE || undefined, { transports: ["websocket", "polling"] });
  return socket;
}
