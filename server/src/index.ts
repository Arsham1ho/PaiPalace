import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env, USE_CLAUDE, USE_GROK } from "./env.js";
import { authRouter } from "./auth.js";
import { apiRouter } from "./routes/api.js";
import { liveGames } from "./game/manager.js";
import { jsonSafe } from "./db.js";

const app = express();
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: env.CLIENT_ORIGIN } });

const aiEngine = USE_GROK ? "grok" : USE_CLAUDE ? "claude" : "simulated";
const aiModel = USE_GROK ? env.XAI_MODEL : USE_CLAUDE ? env.ANTHROPIC_MODEL : "";

app.get("/health", (_req, res) =>
  res.json({ ok: true, aiEngine, model: aiModel }),
);

app.use("/auth", authRouter);
app.use("/api", apiRouter(io));

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
