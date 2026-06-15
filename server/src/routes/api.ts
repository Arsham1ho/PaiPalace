import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { prisma, jsonSafe, fromUsd } from "../db.js";
import { authMiddleware, type AuthedRequest } from "../auth.js";
import { createGame, runGame, liveGames } from "../game/manager.js";

export function apiRouter(io: Server) {
  const r = Router();

  // ---- AGENTS / LEADERBOARD ----
  r.get("/agents", async (req, res) => {
    const sort = (req.query.sort as string) ?? "profit";
    const agents = await prisma.agent.findMany({
      include: { owner: { select: { username: true } }, _count: { select: { investments: true } } },
    });
    const mapped = agents.map(withWinRate).sort((a, b) => {
      if (sort === "winrate") return b.winRate - a.winRate;
      if (sort === "elo") return b.elo - a.elo;
      if (sort === "hands") return b.handsPlayed - a.handsPlayed;
      return Number(b.netProfit) - Number(a.netProfit);
    });
    res.json(jsonSafe(mapped));
  });

  r.get("/agents/:id", async (req, res) => {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { username: true } },
        investments: { include: { user: { select: { username: true } } } },
        decisions: { orderBy: { createdAt: "desc" }, take: 25 },
      },
    });
    if (!agent) return res.status(404).json({ error: "Not found" });
    res.json(jsonSafe(withWinRate(agent)));
  });

  const createAgentSchema = z.object({
    name: z.string().min(2).max(40),
    prompt: z.string().min(10).max(2000),
    avatar: z.string().optional(),
    params: z.object({
      aggression: z.number().min(0).max(1).optional(),
      bluffFreq: z.number().min(0).max(1).optional(),
      tightness: z.number().min(0).max(1).optional(),
      riskTolerance: z.number().min(0).max(1).optional(),
    }).optional(),
    forSale: z.boolean().optional(),
    priceUsd: z.number().min(0).optional(),
  });

  r.post("/agents", authMiddleware, async (req: AuthedRequest, res) => {
    const parsed = createAgentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const agent = await prisma.agent.create({
      data: {
        name: d.name,
        prompt: d.prompt,
        avatar: d.avatar,
        params: JSON.stringify(d.params ?? {}),
        ownerId: req.userId!,
        forSale: d.forSale ?? false,
        price: fromUsd(d.priceUsd ?? 0),
      },
    });
    res.json(jsonSafe(withWinRate(agent)));
  });

  r.post("/agents/:id/buy", authMiddleware, async (req: AuthedRequest, res) => {
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
    if (!agent || !agent.forSale) return res.status(400).json({ error: "Agent not for sale" });
    const buyer = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!buyer || buyer.balance < agent.price) return res.status(402).json({ error: "Insufficient balance" });

    await prisma.$transaction([
      prisma.user.update({ where: { id: buyer.id }, data: { balance: { decrement: agent.price } } }),
      agent.ownerId
        ? prisma.user.update({ where: { id: agent.ownerId }, data: { balance: { increment: agent.price } } })
        : prisma.user.update({ where: { id: buyer.id }, data: {} }),
      prisma.agent.update({ where: { id: agent.id }, data: { ownerId: buyer.id, forSale: false } }),
      prisma.transaction.create({ data: { userId: buyer.id, type: "buy_agent", amount: agent.price, meta: JSON.stringify({ agentId: agent.id }) } }),
    ]);
    res.json({ ok: true });
  });

  r.post("/agents/:id/invest", authMiddleware, async (req: AuthedRequest, res) => {
    const amountUsd = Number(req.body.amountUsd);
    if (!(amountUsd > 0)) return res.status(400).json({ error: "Invalid amount" });
    const micro = fromUsd(amountUsd);
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.balance < micro) return res.status(402).json({ error: "Insufficient balance" });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { balance: { decrement: micro } } }),
      prisma.investment.create({ data: { userId: user.id, agentId: req.params.id, amount: micro, shares: amountUsd } }),
      prisma.transaction.create({ data: { userId: user.id, type: "invest", amount: micro, meta: JSON.stringify({ agentId: req.params.id }) } }),
    ]);
    res.json({ ok: true });
  });

  // ---- WALLET ----
  r.get("/wallet", authMiddleware, async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const txs = await prisma.transaction.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" }, take: 100 });
    res.json(jsonSafe({ balance: user!.balance, walletAddress: user!.walletAddress, transactions: txs }));
  });

  r.post("/wallet/deposit", authMiddleware, async (req: AuthedRequest, res) => {
    const amountUsd = Number(req.body.amountUsd);
    if (!(amountUsd > 0)) return res.status(400).json({ error: "Invalid amount" });
    const micro = fromUsd(amountUsd);
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: { balance: { increment: micro } } }),
      prisma.transaction.create({ data: { userId: req.userId!, type: "deposit", amount: micro, txHash: req.body.txHash ?? null } }),
    ]);
    res.json({ ok: true });
  });

  r.post("/wallet/withdraw", authMiddleware, async (req: AuthedRequest, res) => {
    const amountUsd = Number(req.body.amountUsd);
    const micro = fromUsd(amountUsd);
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.balance < micro) return res.status(402).json({ error: "Insufficient balance" });
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: { balance: { decrement: micro } } }),
      prisma.transaction.create({ data: { userId: req.userId!, type: "withdraw", amount: micro, txHash: req.body.txHash ?? null } }),
    ]);
    res.json({ ok: true });
  });

  // ---- PORTFOLIO ----
  r.get("/portfolio", authMiddleware, async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const investments = await prisma.investment.findMany({
      where: { userId: req.userId },
      include: { agent: true },
    });
    const ownedAgents = await prisma.agent.findMany({ where: { ownerId: req.userId } });
    const txs = await prisma.transaction.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "asc" } });

    // cumulative balance series for the P&L chart
    let running = 0;
    const series = txs.map((t) => {
      const delta = ["deposit", "winnings"].includes(t.type)
        ? Number(t.amount)
        : ["withdraw", "invest", "loss", "buy_agent"].includes(t.type)
          ? -Number(t.amount)
          : Number(t.amount);
      running += delta;
      return { t: t.createdAt, value: running / 1e6, type: t.type };
    });

    res.json(jsonSafe({
      balance: user!.balance,
      investments: investments.map((i) => ({ ...i, agent: withWinRate(i.agent) })),
      ownedAgents: ownedAgents.map(withWinRate),
      series,
    }));
  });

  // ---- GAMES ----
  r.get("/games", async (req, res) => {
    const status = req.query.status as string | undefined;
    const games = await prisma.game.findMany({
      where: status ? { status } : undefined,
      include: { seats: { include: { agent: { select: { name: true, avatar: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(jsonSafe(games));
  });

  r.get("/games/:id", async (req, res) => {
    const game = await prisma.game.findUnique({
      where: { id: req.params.id },
      include: {
        seats: { include: { agent: true, user: { select: { username: true } } }, orderBy: { seatIndex: "asc" } },
        decisions: { orderBy: { createdAt: "asc" }, include: { agent: { select: { name: true } } } },
      },
    });
    if (!game) return res.status(404).json({ error: "Not found" });
    const live = liveGames.get(game.id);
    res.json(jsonSafe({ ...game, live: live ? live.state : null }));
  });

  const createGameSchema = z.object({
    name: z.string().min(2).max(50),
    buyInChips: z.number().int().min(100).max(100000).default(1000),
    smallBlind: z.number().int().min(1).default(5),
    bigBlind: z.number().int().min(2).default(10),
    agentIds: z.array(z.string()).min(2).max(6),
  });

  r.post("/games", authMiddleware, async (req: AuthedRequest, res) => {
    const parsed = createGameSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    // the creator fields all their selected agents; others run as house seats
    const agents = await prisma.agent.findMany({ where: { id: { in: d.agentIds } } });
    const game = await createGame({
      name: d.name,
      buyInChips: d.buyInChips,
      smallBlind: d.smallBlind,
      bigBlind: d.bigBlind,
      agents: agents.map((a) => ({ agentId: a.id, userId: a.ownerId === req.userId ? req.userId : a.ownerId })),
    });
    // run asynchronously; clients watch via sockets
    runGame(io, game.id).catch((e) => console.error("[game] run failed", e));
    res.json(jsonSafe(game));
  });

  // ---- PUBLIC USERS / TRANSPARENCY ----
  r.get("/users", async (_req, res) => {
    const users = await prisma.user.findMany({
      include: { _count: { select: { agents: true, investments: true } } },
      orderBy: { balance: "desc" },
      take: 100,
    });
    res.json(jsonSafe(users.map((u) => ({
      id: u.id, username: u.username, walletAddress: u.walletAddress,
      balance: u.balance, agents: u._count.agents, investments: u._count.investments, createdAt: u.createdAt,
    }))));
  });

  r.get("/users/:id", async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        agents: true,
        transactions: { orderBy: { createdAt: "desc" }, take: 50 },
        investments: { include: { agent: { select: { name: true } } } },
      },
    });
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(jsonSafe({
      id: user.id, username: user.username, walletAddress: user.walletAddress,
      balance: user.balance, createdAt: user.createdAt,
      agents: user.agents.map(withWinRate),
      transactions: user.transactions,
      investments: user.investments,
    }));
  });

  return r;
}

function withWinRate<T extends { handsPlayed: number; handsWon: number; netProfit: bigint; elo: number }>(a: T) {
  return { ...a, winRate: a.handsPlayed > 0 ? a.handsWon / a.handsPlayed : 0 };
}
