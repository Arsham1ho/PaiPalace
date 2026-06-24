import { Router } from "express";
import type { Server } from "socket.io";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma, jsonSafe, fromUsd } from "../db.js";
import { authMiddleware, adminMiddleware, type AuthedRequest } from "../auth.js";
import { createGame, runGame, liveGames, submitHumanAction, room as roomChannel } from "../game/manager.js";
import { improvePrompt } from "../agents/improve.js";
import {
  isValidSolanaAddress,
  verifyUsdcDeposit,
  sendUsdcFromTreasury,
  generateDepositWallet,
  getUsdcBalance,
  TREASURY_ADDRESS,
  SOLANA_CONFIGURED,
  WITHDRAWALS_ENABLED,
} from "../solana.js";

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

  // agents owned by the current user (created + bought)
  r.get("/agents/mine", authMiddleware, async (req: AuthedRequest, res) => {
    const agents = await prisma.agent.findMany({
      where: { ownerId: req.userId },
      include: { _count: { select: { investments: true } } },
      orderBy: { createdAt: "desc" },
    });
    const buys = await prisma.transaction.findMany({ where: { userId: req.userId, type: "buy_agent" } });
    const bought = new Set(buys.map((t) => { try { return JSON.parse(t.meta).agentId; } catch { return null; } }).filter(Boolean));
    res.json(jsonSafe(agents.map((a) => ({ ...withWinRate(a), bought: bought.has(a.id) }))));
  });

  // check agent-name availability (case-insensitive)
  r.get("/agents/check-name", async (req, res) => {
    const name = String(req.query.name ?? "").trim();
    if (name.length < 2) return res.json({ available: false, reason: "too short" });
    const all = await prisma.agent.findMany({ select: { name: true } });
    const taken = all.some((a) => a.name.toLowerCase() === name.toLowerCase());
    res.json({ available: !taken });
  });

  // improve a strategy prompt (Claude when configured, heuristic otherwise)
  r.post("/agents/improve-prompt", authMiddleware, async (req: AuthedRequest, res) => {
    const prompt = String(req.body.prompt ?? "").trim();
    if (prompt.length < 10) return res.status(400).json({ error: "Write a few words first, then improve it." });
    const result = await improvePrompt(prompt.slice(0, 2000));
    res.json(result);
  });

  r.get("/agents/:id", async (req, res) => {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, username: true } },
        investments: { include: { user: { select: { id: true, username: true } } } },
        decisions: { orderBy: { createdAt: "desc" }, take: 25 },
      },
    });
    if (!agent) return res.status(404).json({ error: "Not found" });

    // users who have fielded this agent in a game
    const fielderSeats = await prisma.seat.findMany({
      where: { agentId: agent.id, userId: { not: null } },
      include: { user: { select: { id: true, username: true } } },
    });
    const fielders = Array.from(new Map(fielderSeats.map((s) => [s.userId, s.user])).values());

    res.json(jsonSafe({ ...withWinRate(agent), fielders }));
  });

  // Per-game performance series + win/loss record for an agent.
  r.get("/agents/:id/performance", async (req, res) => {
    const seats = await prisma.seat.findMany({
      where: { agentId: req.params.id, game: { status: "finished" } },
      include: { game: { select: { id: true, name: true, buyIn: true, finishedAt: true } } },
    });
    seats.sort((a, b) => (a.game.finishedAt?.getTime() ?? 0) - (b.game.finishedAt?.getTime() ?? 0));

    const CHIP = 10_000; // micro-USDC per chip
    let cum = 0;
    let wins = 0, losses = 0, profitMicro = 0, lossMicro = 0;
    const series = seats.map((s) => {
      const netChips = Number(s.stack) - Number(s.game.buyIn);
      const micro = netChips * CHIP;
      cum += micro;
      if (netChips > 0) { wins++; profitMicro += micro; }
      else if (netChips < 0) { losses++; lossMicro += -micro; }
      return { t: s.game.finishedAt, gameId: s.game.id, name: s.game.name, netMicro: micro, cumMicro: cum };
    });

    res.json(jsonSafe({
      series,
      record: { games: seats.length, wins, losses, profitMicro, lossMicro, netMicro: cum },
    }));
  });

  const unit = () => z.number().min(0).max(1).optional();
  // tunable strategy parameters (basic + professional) — accepted on create/update
  const agentParamsSchema = z.object({
    aggression: unit(), bluffFreq: unit(), tightness: unit(), riskTolerance: unit(),
    betSizing: unit(), contBet: unit(), callingTendency: unit(), trapping: unit(),
    threeBetFreq: unit(), positionAwareness: unit(), potControl: unit(), foldDiscipline: unit(), valueBetting: unit(),
  });

  const createAgentSchema = z.object({
    name: z.string().min(2).max(40),
    prompt: z.string().min(10).max(2000),
    avatar: z.string().max(400_000).optional(),
    params: agentParamsSchema.optional(),
    forSale: z.boolean().optional(),
    priceUsd: z.number().min(0).optional(),
  });

  r.post("/agents", authMiddleware, async (req: AuthedRequest, res) => {
    const parsed = createAgentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    // enforce unique agent name (case-insensitive)
    const existing = await prisma.agent.findMany({ select: { name: true } });
    if (existing.some((a) => a.name.toLowerCase() === d.name.trim().toLowerCase())) {
      return res.status(409).json({ error: "An agent with that name already exists. Choose a unique name." });
    }
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

  // edit an agent (owner only)
  const updateAgentSchema = z.object({
    name: z.string().min(2).max(40).optional(),
    prompt: z.string().min(10).max(2000).optional(),
    avatar: z.string().max(400_000).optional(),
    params: agentParamsSchema.optional(),
    forSale: z.boolean().optional(),
    priceUsd: z.number().min(0).optional(),
  });
  r.patch("/agents/:id", authMiddleware, async (req: AuthedRequest, res) => {
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
    if (!agent) return res.status(404).json({ error: "Not found" });
    if (agent.ownerId !== req.userId) return res.status(403).json({ error: "Not your agent" });
    const parsed = updateAgentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    if (d.name && d.name.trim().toLowerCase() !== agent.name.toLowerCase()) {
      const all = await prisma.agent.findMany({ select: { name: true } });
      if (all.some((a) => a.name.toLowerCase() === d.name!.trim().toLowerCase())) {
        return res.status(409).json({ error: "An agent with that name already exists." });
      }
    }
    const updated = await prisma.agent.update({
      where: { id: agent.id },
      data: {
        name: d.name?.trim() ?? undefined,
        prompt: d.prompt ?? undefined,
        avatar: d.avatar ?? undefined,
        params: d.params ? JSON.stringify(d.params) : undefined,
        forSale: d.forSale ?? undefined,
        price: d.priceUsd !== undefined ? fromUsd(d.priceUsd) : undefined,
      },
    });
    res.json(jsonSafe(withWinRate(updated)));
  });

  // delete an agent (owner only; blocked if it has investors)
  r.delete("/agents/:id", authMiddleware, async (req: AuthedRequest, res) => {
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
    if (!agent) return res.status(404).json({ error: "Not found" });
    if (agent.ownerId !== req.userId) return res.status(403).json({ error: "Not your agent" });
    const investors = await prisma.investment.count({ where: { agentId: agent.id } });
    if (investors > 0) return res.status(400).json({ error: "Can't delete an agent with active backers. Unlist and refund first." });
    await prisma.$transaction([
      prisma.decision.deleteMany({ where: { agentId: agent.id } }),
      prisma.seat.deleteMany({ where: { agentId: agent.id } }),
      prisma.agent.delete({ where: { id: agent.id } }),
    ]);
    res.json({ ok: true });
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

  // ---- WALLET (Solana USDC) ----
  r.get("/wallet", authMiddleware, async (req: AuthedRequest, res) => {
    let user = await prisma.user.findUnique({ where: { id: req.userId } });
    // backfill: ensure every user has a dedicated deposit address
    if (user && !user.depositAddress) {
      const dw = generateDepositWallet();
      user = await prisma.user.update({ where: { id: user.id }, data: { depositAddress: dw.address, depositSecret: dw.encryptedSecret } });
    }
    const txs = await prisma.transaction.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" }, take: 100 });
    res.json(jsonSafe({
      balance: user!.balance,
      walletAddress: user!.walletAddress,
      depositAddress: user!.depositAddress,
      treasuryAddress: TREASURY_ADDRESS || null,
      solanaConfigured: SOLANA_CONFIGURED,
      withdrawalsEnabled: WITHDRAWALS_ENABLED,
      transactions: txs,
    }));
  });

  // Direct deposit: detect new USDC sent to the user's dedicated deposit address.
  r.post("/wallet/deposit/sync", authMiddleware, async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.depositAddress) return res.status(400).json({ error: "No deposit address" });
    let onchainUsd: number;
    try {
      onchainUsd = await getUsdcBalance(user.depositAddress);
    } catch (e: any) {
      return res.status(502).json({ error: "Could not read on-chain balance: " + e.message });
    }
    const onchainMicro = fromUsd(onchainUsd);
    const newMicro = onchainMicro - user.creditedDeposits;
    if (newMicro <= 0n) return res.json({ ok: true, credited: 0, balance: Number(user.balance) });
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { balance: { increment: newMicro }, creditedDeposits: onchainMicro } }),
      prisma.transaction.create({ data: { userId: user.id, type: "deposit", amount: newMicro, meta: JSON.stringify({ via: "deposit_address" }) } }),
    ]);
    res.json({ ok: true, credited: Number(newMicro) });
  });

  // Link the user's connected Phantom (Solana) wallet address.
  r.post("/wallet/link", authMiddleware, async (req: AuthedRequest, res) => {
    const address = String(req.body.address ?? "").trim();
    if (!isValidSolanaAddress(address)) return res.status(400).json({ error: "Invalid Solana address" });
    const taken = await prisma.user.findFirst({ where: { walletAddress: address, NOT: { id: req.userId } } });
    if (taken) return res.status(409).json({ error: "Address already linked to another account" });
    await prisma.user.update({ where: { id: req.userId }, data: { walletAddress: address } });
    res.json({ ok: true, walletAddress: address });
  });

  // Confirm a real on-chain USDC deposit by its transaction signature.
  r.post("/wallet/deposit", authMiddleware, async (req: AuthedRequest, res) => {
    const signature = String(req.body.signature ?? "").trim();
    if (!signature) return res.status(400).json({ error: "Missing transaction signature" });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.walletAddress) return res.status(400).json({ error: "Connect your wallet first" });
    if (!SOLANA_CONFIGURED) return res.status(503).json({ error: "Deposits not configured (treasury/RPC missing)" });

    // prevent replay: each signature can only credit once
    const seen = await prisma.transaction.findFirst({ where: { txHash: signature } });
    if (seen) return res.status(409).json({ error: "This deposit was already processed" });

    let verified;
    try {
      verified = await verifyUsdcDeposit(signature, user.walletAddress);
    } catch (e: any) {
      return res.status(502).json({ error: "Could not verify on-chain: " + e.message });
    }
    if (!verified) return res.status(400).json({ error: "No USDC deposit to the treasury found in that transaction" });

    const micro = fromUsd(verified.amountUsd);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { balance: { increment: micro } } }),
      prisma.transaction.create({ data: { userId: user.id, type: "deposit", amount: micro, txHash: signature } }),
    ]);
    res.json({ ok: true, amountUsd: verified.amountUsd });
  });

  // Withdraw USDC from the treasury to the user's connected wallet.
  r.post("/wallet/withdraw", authMiddleware, async (req: AuthedRequest, res) => {
    const amountUsd = Number(req.body.amountUsd);
    if (!(amountUsd > 0)) return res.status(400).json({ error: "Invalid amount" });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.walletAddress) return res.status(400).json({ error: "Connect your wallet first" });
    const micro = fromUsd(amountUsd);
    if (user.balance < micro) return res.status(402).json({ error: "Insufficient balance" });
    if (!WITHDRAWALS_ENABLED) return res.status(503).json({ error: "Withdrawals temporarily unavailable" });

    let signature: string;
    try {
      signature = await sendUsdcFromTreasury(user.walletAddress, amountUsd);
    } catch (e: any) {
      return res.status(502).json({ error: "On-chain transfer failed: " + e.message });
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { balance: { decrement: micro } } }),
      prisma.transaction.create({ data: { userId: user.id, type: "withdraw", amount: micro, txHash: signature } }),
    ]);
    res.json({ ok: true, signature });
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

  // A human player submits their action when it's their turn (manual-play seats).
  r.post("/games/:id/act", authMiddleware, async (req: AuthedRequest, res) => {
    const { type, amount } = req.body ?? {};
    const result = submitHumanAction(req.params.id, req.userId!, type, amount === undefined ? undefined : Number(amount));
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
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

  // Test match: flat 5 USDC fee, your agent vs the house AI, NO real P&L applied.
  const TEST_FEE_USD = 5;
  r.post("/games/test", authMiddleware, async (req: AuthedRequest, res) => {
    const agentId = String(req.body.agentId ?? "");
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const fee = fromUsd(TEST_FEE_USD);
    if (!user || user.balance < fee) return res.status(402).json({ error: `You need ${TEST_FEE_USD} USDC to start a test match.` });
    const houses = await prisma.agent.findMany({ where: { ownerId: null, id: { not: agentId } }, take: 3 });
    if (houses.length < 1) return res.status(400).json({ error: "No house agents available right now." });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { balance: { decrement: fee } } }),
      prisma.transaction.create({ data: { userId: user.id, type: "test_fee", amount: fee, meta: JSON.stringify({ agentId }) } }),
    ]);
    const game = await createGame({
      name: `Test Match · ${agent.name}`,
      buyInChips: 1000, smallBlind: 5, bigBlind: 10,
      practice: true,
      agents: [{ agentId, userId: user.id }, ...houses.map((h) => ({ agentId: h.id, userId: null }))],
    });
    runGame(io, game.id).catch((e) => console.error("[test] run failed", e));
    res.json(jsonSafe(game));
  });

  // Free instant practice match: YOU play your seat manually vs house AI.
  // No fee, no real P&L — the "Play now" entry point.
  r.post("/games/play", authMiddleware, async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(401).json({ error: "Not signed in" });
    const houses = await prisma.agent.findMany({ where: { ownerId: null }, take: 4 });
    if (houses.length < 2) return res.status(400).json({ error: "No house agents available right now." });
    // identity skin: the user's own agent if they have one, otherwise a house agent
    const mine = (await prisma.agent.findFirst({ where: { ownerId: user.id } })) ?? houses[0];
    const opponents = houses.filter((h) => h.id !== mine.id).slice(0, 2);
    const game = await createGame({
      name: `${user.username} vs AI`,
      buyInChips: 1000, smallBlind: 5, bigBlind: 10, practice: true,
      agents: [{ agentId: mine.id, userId: user.id, isHuman: true }, ...opponents.map((h) => ({ agentId: h.id, userId: null }))],
    });
    runGame(io, game.id).catch((e) => console.error("[play] run failed", e));
    res.json(jsonSafe(game));
  });

  // ---- MULTIPLAYER ROOMS ----
  const ROOM_BUYIN = 1000;
  const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  const roomSummary = (rm: any) => ({
    id: rm.id, name: rm.name, players: rm.seats.length, maxPlayers: 6,
    entryMicro: rm.entryMicro, prizePool: rm.prizePool, smallBlind: rm.smallBlind, bigBlind: rm.bigBlind,
    visibility: rm.visibility, status: rm.status, createdAt: rm.createdAt,
    seats: rm.seats.map((s: any) => ({ seatIndex: s.seatIndex, agent: s.agent })),
  });

  // Resolve the agent that represents a seat. For a human player the agent is
  // just a table identity — use their own if provided, otherwise any house
  // agent — so you don't need to build an AI agent just to play yourself.
  // For an AI-controlled seat you must field one of your own agents.
  async function pickSeatAgent(agentId: any, userId: string, human: boolean) {
    const owned = agentId ? await prisma.agent.findUnique({ where: { id: String(agentId) } }) : null;
    if (human) {
      if (owned && owned.ownerId === userId) return owned;
      const house = await prisma.agent.findFirst({ where: { ownerId: null } });
      if (house) return house;
      return { error: "No table identities available right now.", status: 400 as const };
    }
    if (!owned) return { error: "Agent not found", status: 404 as const };
    if (owned.ownerId !== userId) return { error: "Use one of your own agents", status: 403 as const };
    return owned;
  }

  r.post("/rooms", authMiddleware, async (req: AuthedRequest, res) => {
    const { visibility = "public", password, agentId, entryUsd = 5, smallBlind = 5, bigBlind = 10, name, human = false } = req.body ?? {};
    if (!["public", "private"].includes(visibility)) return res.status(400).json({ error: "Invalid visibility" });
    const entry = fromUsd(Number(entryUsd) || 0);
    const agent = await pickSeatAgent(agentId, req.userId!, !!human);
    if ("error" in agent) return res.status(agent.status).json({ error: agent.error });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.balance < entry) return res.status(402).json({ error: "Insufficient balance for the entry fee" });
    let code = genCode();
    for (let i = 0; i < 5; i++) { if (!(await prisma.game.findUnique({ where: { roomCode: code } }))) break; code = genCode(); }
    const passwordHash = visibility === "private" && password ? await bcrypt.hash(String(password), 10) : null;
    const roomName = String(name ?? "").trim().slice(0, 40) || `${user.username}'s Room`;
    const game = await prisma.game.create({
      data: {
        name: roomName, isRoom: true, status: "lobby", visibility, roomCode: code, passwordHash,
        hostId: user.id, smallBlind: BigInt(smallBlind), bigBlind: BigInt(bigBlind),
        buyIn: BigInt(ROOM_BUYIN), entryMicro: entry, prizePool: entry,
      },
    });
    await prisma.seat.create({ data: { gameId: game.id, agentId: agent.id, userId: user.id, isHuman: !!human, seatIndex: 0, stack: BigInt(ROOM_BUYIN), startStack: BigInt(ROOM_BUYIN) } });
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { balance: { decrement: entry } } }),
      prisma.transaction.create({ data: { userId: user.id, type: "room_entry", amount: entry, meta: JSON.stringify({ gameId: game.id }) } }),
    ]);
    res.json(jsonSafe({ id: game.id, roomCode: code }));
  });

  r.get("/rooms", async (_req, res) => {
    const rooms = await prisma.game.findMany({
      where: { isRoom: true, status: "lobby", visibility: "public" },
      include: { seats: { include: { agent: { select: { name: true, avatar: true } } } } },
      orderBy: { createdAt: "desc" }, take: 50,
    });
    res.json(jsonSafe(rooms.map(roomSummary)));
  });

  r.get("/rooms/code/:code", async (req, res) => {
    const room = await prisma.game.findUnique({ where: { roomCode: req.params.code.toUpperCase() } });
    if (!room || !room.isRoom) return res.status(404).json({ error: "Room not found" });
    res.json({ id: room.id });
  });

  r.get("/rooms/:id", authMiddleware, async (req: AuthedRequest, res) => {
    const room = await prisma.game.findUnique({
      where: { id: req.params.id },
      include: { seats: { include: { agent: { select: { name: true, avatar: true } }, user: { select: { id: true, username: true } } }, orderBy: { seatIndex: "asc" } } },
    });
    if (!room || !room.isRoom) return res.status(404).json({ error: "Room not found" });
    res.json(jsonSafe({
      id: room.id, name: room.name, status: room.status, visibility: room.visibility, roomCode: room.roomCode,
      entryMicro: room.entryMicro, prizePool: room.prizePool, smallBlind: room.smallBlind, bigBlind: room.bigBlind,
      hostId: room.hostId, isHost: room.hostId === req.userId,
      needsPassword: room.visibility === "private" && !!room.passwordHash,
      joined: room.seats.some((s) => s.userId === req.userId),
      maxPlayers: 6,
      players: room.seats.map((s) => ({ seatIndex: s.seatIndex, userId: s.userId, username: s.user?.username, agent: s.agent, isHuman: s.isHuman })),
    }));
  });

  r.post("/rooms/:id/join", authMiddleware, async (req: AuthedRequest, res) => {
    const { agentId, password, human = false } = req.body ?? {};
    const room = await prisma.game.findUnique({ where: { id: req.params.id }, include: { seats: true } });
    if (!room || !room.isRoom) return res.status(404).json({ error: "Room not found" });
    if (room.status !== "lobby") return res.status(400).json({ error: "Room has already started" });
    if (room.seats.length >= 6) return res.status(400).json({ error: "Room is full" });
    if (room.seats.some((s) => s.userId === req.userId)) return res.status(400).json({ error: "You're already in this room" });
    if (room.visibility === "private" && room.passwordHash) {
      if (!password || !(await bcrypt.compare(String(password), room.passwordHash))) return res.status(401).json({ error: "Wrong password" });
    }
    const agent = await pickSeatAgent(agentId, req.userId!, !!human);
    if ("error" in agent) return res.status(agent.status).json({ error: agent.error });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.balance < room.entryMicro) return res.status(402).json({ error: "Insufficient balance for the entry fee" });
    await prisma.$transaction([
      prisma.seat.create({ data: { gameId: room.id, agentId: agent.id, userId: user.id, isHuman: !!human, seatIndex: room.seats.length, stack: room.buyIn, startStack: room.buyIn } }),
      prisma.user.update({ where: { id: user.id }, data: { balance: { decrement: room.entryMicro } } }),
      prisma.game.update({ where: { id: room.id }, data: { prizePool: { increment: room.entryMicro } } }),
      prisma.transaction.create({ data: { userId: user.id, type: "room_entry", amount: room.entryMicro, meta: JSON.stringify({ gameId: room.id }) } }),
    ]);
    io.to(roomChannel(room.id)).emit("room:update", { id: room.id }); // notify lobby viewers
    res.json({ ok: true });
  });

  // host adds a house AI opponent to fill a seat
  r.post("/rooms/:id/add-bot", authMiddleware, async (req: AuthedRequest, res) => {
    const room = await prisma.game.findUnique({ where: { id: req.params.id }, include: { seats: true } });
    if (!room || !room.isRoom) return res.status(404).json({ error: "Room not found" });
    if (room.hostId !== req.userId) return res.status(403).json({ error: "Only the host can add opponents" });
    if (room.status !== "lobby") return res.status(400).json({ error: "Already started" });
    if (room.seats.length >= 6) return res.status(400).json({ error: "Room is full" });
    const used = room.seats.map((s) => s.agentId);
    const bot = await prisma.agent.findFirst({ where: { ownerId: null, id: { notIn: used } } });
    if (!bot) return res.status(400).json({ error: "No house agents available" });
    await prisma.seat.create({ data: { gameId: room.id, agentId: bot.id, userId: null, seatIndex: room.seats.length, stack: room.buyIn, startStack: room.buyIn } });
    io.to(roomChannel(room.id)).emit("room:update", { id: room.id });
    res.json({ ok: true });
  });

  r.post("/rooms/:id/start", authMiddleware, async (req: AuthedRequest, res) => {
    const room = await prisma.game.findUnique({ where: { id: req.params.id }, include: { seats: true } });
    if (!room || !room.isRoom) return res.status(404).json({ error: "Room not found" });
    if (room.hostId !== req.userId) return res.status(403).json({ error: "Only the host can start" });
    if (room.status !== "lobby") return res.status(400).json({ error: "Already started" });
    if (room.seats.length < 2) return res.status(400).json({ error: "Need at least 2 players to start" });
    await prisma.game.update({ where: { id: room.id }, data: { status: "waiting" } });
    runGame(io, room.id).catch((e) => console.error("[room] run failed", e));
    res.json({ ok: true });
  });

  // ---- PUBLIC PLATFORM STATS ----
  r.get("/stats", async (_req, res) => {
    const [agents, players, games, decisions, liveGames] = await Promise.all([
      prisma.agent.count(),
      prisma.user.count(),
      prisma.game.count(),
      prisma.decision.count(),
      prisma.game.count({ where: { status: "running" } }),
    ]);
    const hands = await prisma.agent.aggregate({ _sum: { handsPlayed: true } });
    res.json(jsonSafe({ agents, players, games, decisions, liveGames, hands: hands._sum.handsPlayed ?? 0 }));
  });

  // ---- ACCOUNT LEADERBOARD ----
  r.get("/leaderboard", async (req, res) => {
    const period = (req.query.period as string) ?? "all";
    const now = Date.now();
    const since =
      period === "day" ? new Date(now - 864e5) :
      period === "week" ? new Date(now - 7 * 864e5) :
      period === "month" ? new Date(now - 30 * 864e5) : null;

    const txs = await prisma.transaction.findMany({
      where: since ? { createdAt: { gte: since } } : {},
      select: { userId: true, type: true, amount: true },
    });
    const agg = new Map<string, { profit: bigint; volume: bigint }>();
    for (const t of txs) {
      const m = agg.get(t.userId) ?? { profit: 0n, volume: 0n };
      if (t.type === "winnings") { m.profit += t.amount; m.volume += t.amount; }
      else if (t.type === "loss") { m.profit -= t.amount; m.volume += t.amount; }
      else if (t.type === "invest" || t.type === "buy_agent") { m.volume += t.amount; }
      agg.set(t.userId, m);
    }
    const users = await prisma.user.findMany({ include: { _count: { select: { agents: true, investments: true } } } });
    const rows = users.map((u) => {
      const m = agg.get(u.id) ?? { profit: 0n, volume: 0n };
      return {
        id: u.id, username: u.username, walletAddress: u.walletAddress, createdAt: u.createdAt,
        agents: u._count.agents, investments: u._count.investments,
        profit: m.profit, volume: m.volume,
      };
    }).sort((a, b) => (b.profit > a.profit ? 1 : b.profit < a.profit ? -1 : Number(b.volume - a.volume)));
    res.json(jsonSafe(rows.slice(0, 100)));
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
        investments: { include: { agent: true } },
      },
    });
    if (!user) return res.status(404).json({ error: "Not found" });

    const allTx = await prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    let profit = 0n, volume = 0n, deposited = 0n, withdrawn = 0n, running = 0;
    const series: { t: Date; value: number }[] = [];
    for (const t of allTx) {
      const a = Number(t.amount);
      if (t.type === "winnings") { profit += t.amount; volume += t.amount; running += a; }
      else if (t.type === "loss") { profit -= t.amount; volume += t.amount; running -= a; }
      else if (t.type === "invest" || t.type === "buy_agent") { volume += t.amount; running -= a; }
      else if (t.type === "deposit") { deposited += t.amount; running += a; }
      else if (t.type === "withdraw") { withdrawn += t.amount; running -= a; }
      series.push({ t: t.createdAt, value: running / 1e6 });
    }
    const wins = allTx.filter((t) => t.type === "winnings").length;
    const losses = allTx.filter((t) => t.type === "loss").length;

    res.json(jsonSafe({
      id: user.id, username: user.username, walletAddress: user.walletAddress,
      balance: user.balance, createdAt: user.createdAt,
      agents: user.agents.map(withWinRate),
      investments: user.investments.map((i) => ({ ...i, agent: withWinRate(i.agent) })),
      transactions: allTx.slice(-60).reverse(),
      summary: { profit, volume, deposited, withdrawn, wins, losses },
      series,
    }));
  });

  // ---- ADMIN (owner only) ----
  r.get("/admin/stats", authMiddleware, adminMiddleware, async (_req, res) => {
    const [users, agents, games, decisions] = await Promise.all([
      prisma.user.count(),
      prisma.agent.count(),
      prisma.game.count(),
      prisma.decision.count(),
    ]);
    const balAgg = await prisma.user.aggregate({ _sum: { balance: true } });
    const deposits = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: "deposit" } });
    const withdrawals = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: "withdraw" } });
    res.json(jsonSafe({
      users, agents, games, decisions,
      totalBalance: balAgg._sum.balance ?? 0n,
      totalDeposits: deposits._sum.amount ?? 0n,
      totalWithdrawals: withdrawals._sum.amount ?? 0n,
    }));
  });

  r.get("/admin/users", authMiddleware, adminMiddleware, async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { agents: true, investments: true, transactions: true } } },
    });
    res.json(jsonSafe(users.map((u) => ({
      id: u.id, email: u.email, username: u.username, walletAddress: u.walletAddress,
      balance: u.balance, isAdmin: u.isAdmin, banned: u.banned, createdAt: u.createdAt,
      agents: u._count.agents, investments: u._count.investments, transactions: u._count.transactions,
    }))));
  });

  r.post("/admin/users/:id/balance", authMiddleware, adminMiddleware, async (req: AuthedRequest, res) => {
    const setUsd = Number(req.body.setUsd);
    if (!(setUsd >= 0)) return res.status(400).json({ error: "Invalid amount" });
    const micro = fromUsd(setUsd);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: "Not found" });
    const delta = micro - target.balance;
    await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { balance: micro } }),
      prisma.transaction.create({ data: { userId: target.id, type: "admin_adjust", amount: delta < 0n ? -delta : delta, meta: JSON.stringify({ by: req.userId, newBalanceUsd: setUsd }) } }),
    ]);
    res.json({ ok: true });
  });

  r.post("/admin/users/:id/ban", authMiddleware, adminMiddleware, async (req, res) => {
    await prisma.user.update({ where: { id: req.params.id }, data: { banned: !!req.body.banned } });
    res.json({ ok: true });
  });

  r.post("/admin/users/:id/admin", authMiddleware, adminMiddleware, async (req, res) => {
    await prisma.user.update({ where: { id: req.params.id }, data: { isAdmin: !!req.body.isAdmin } });
    res.json({ ok: true });
  });

  r.delete("/admin/users/:id", authMiddleware, adminMiddleware, async (req: AuthedRequest, res) => {
    if (req.params.id === req.userId) return res.status(400).json({ error: "You can't delete your own admin account" });
    const id = req.params.id;
    await prisma.$transaction([
      prisma.investment.deleteMany({ where: { userId: id } }),
      prisma.transaction.deleteMany({ where: { userId: id } }),
      prisma.seat.updateMany({ where: { userId: id }, data: { userId: null } }),
      prisma.agent.updateMany({ where: { ownerId: id }, data: { ownerId: null, forSale: false } }),
      prisma.user.delete({ where: { id } }),
    ]);
    res.json({ ok: true });
  });

  return r;
}

function withWinRate<T extends { handsPlayed: number; handsWon: number; netProfit: bigint; elo: number }>(a: T) {
  return { ...a, winRate: a.handsPlayed > 0 ? a.handsWon / a.handsPlayed : 0 };
}
