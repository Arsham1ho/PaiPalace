import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { env, USE_CLAUDE, USE_GROK } from "./env.js";
import { authRouter } from "./auth.js";
import { apiRouter } from "./routes/api.js";
import { liveGames } from "./game/manager.js";
import { jsonSafe } from "./db.js";

const app = express();
// When CLIENT_ORIGIN is set (separate frontend host) restrict to it; otherwise
// the client is served same-origin and CORS can reflect the request origin.
const corsOrigin = env.CLIENT_ORIGIN || true;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: corsOrigin, credentials: true } });

const aiEngine = USE_GROK ? "grok" : USE_CLAUDE ? "claude" : "simulated";
const aiModel = USE_GROK ? env.XAI_MODEL : USE_CLAUDE ? env.ANTHROPIC_MODEL : "";

app.get("/health", (_req, res) =>
  res.json({ ok: true, aiEngine, model: aiModel }),
);

app.use("/auth", authRouter);
app.use("/api", apiRouter(io));

// In production, serve the built client from the same origin and fall back to
// index.html for client-side routes (anything that isn't an API/socket path).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path.startsWith("/socket.io")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

io.on("connection", (socket) => {
  socket.on("game:watch", (gameId: string) => {
    socket.join(`game:${gameId}`);
    const live = liveGames.get(gameId);
    if (live) socket.emit("game:snapshot", jsonSafe({ gameId, state: live.state }));
  });
  socket.on("game:leave", (gameId: string) => socket.leave(`game:${gameId}`));
});

httpServer.listen(env.PORT, () => {
  console.log(`\n  🎰 PaiPalace API on http://localhost:${env.PORT}`);
  console.log(`  AI engine: ${aiEngine === "grok" ? `Grok (${env.XAI_MODEL})` : aiEngine === "claude" ? `Claude (${env.ANTHROPIC_MODEL})` : "simulated strategy engine"}\n`);
});
