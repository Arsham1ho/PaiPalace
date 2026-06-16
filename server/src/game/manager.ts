import type { Server } from "socket.io";
import { prisma, jsonSafe } from "../db.js";
import {
  startHand,
  applyAction,
  bettingRoundComplete,
  advanceStreet,
  handOver,
  settle,
  liveSeats,
  type SeatSeed,
} from "../poker/engine.js";
import type { HandState } from "../poker/types.js";
import { decideAction, type AgentParams } from "../agents/index.js";

const CHIP_VALUE_MICRO = 10_000n; // 1 chip = $0.01
const MAX_HANDS = 25;
const ACTION_DELAY_MS = 700;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AgentMeta {
  id: string;
  name: string;
  prompt: string;
  params: AgentParams;
  userId?: string | null;
}

// In-memory snapshot registry so spectators can join a game in progress.
export const liveGames = new Map<string, { state: HandState; name: string }>();

export interface CreateGameInput {
  name: string;
  buyInChips: number;
  smallBlind: number;
  bigBlind: number;
  agents: { agentId: string; userId?: string | null }[];
}

export async function createGame(input: CreateGameInput) {
  const game = await prisma.game.create({
    data: {
      name: input.name,
      status: "waiting",
      smallBlind: BigInt(input.smallBlind),
      bigBlind: BigInt(input.bigBlind),
      buyIn: BigInt(input.buyInChips),
    },
  });
  for (let i = 0; i < input.agents.length; i++) {
    const a = input.agents[i];
    await prisma.seat.create({
      data: {
        gameId: game.id,
        agentId: a.agentId,
        userId: a.userId ?? null,
        seatIndex: i,
        stack: BigInt(input.buyInChips),
        startStack: BigInt(input.buyInChips),
      },
    });
  }
  return game;
}

// A no-op Socket.IO stand-in for headless (seed / offline) game runs.
const stubIo = { to: () => ({ emit: () => {} }) } as unknown as Server;

/** Run a game with no sockets and no delays — used for seeding real data. */
export function runGameHeadless(gameId: string) {
  return runGame(stubIo, gameId, { delayMs: 0 });
}

export async function runGame(io: Server, gameId: string, opts?: { delayMs?: number }) {
  const delay = opts?.delayMs ?? ACTION_DELAY_MS;
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { seats: { include: { agent: true }, orderBy: { seatIndex: "asc" } } },
  });
  if (!game) return;

  const metas: AgentMeta[] = game.seats.map((s) => ({
    id: s.agent.id,
    name: s.agent.name,
    prompt: s.agent.prompt,
    params: safeParams(s.agent.params),
    userId: s.userId,
  }));
  const metaBySeat = new Map<number, AgentMeta>();
  game.seats.forEach((s, i) => metaBySeat.set(i, metas[i]));

  const buyIn = Number(game.buyIn);
  let stacks = game.seats.map(() => buyIn);
  const sb = Number(game.smallBlind);
  const bb = Number(game.bigBlind);

  await prisma.game.update({ where: { id: game.id }, data: { status: "running" } });

  io.to(room(gameId)).emit("game:start", { gameId, name: game.name });

  let dealer = 0;
  for (let handNumber = 1; handNumber <= MAX_HANDS; handNumber++) {
    const alive = stacks.map((s, i) => ({ s, i })).filter((x) => x.s > 0);
    if (alive.length <= 1) break;

    const seeds: SeatSeed[] = alive.map(({ s, i }) => ({
      seatIndex: i,
      agentId: metaBySeat.get(i)!.id,
      agentName: metaBySeat.get(i)!.name,
      userId: metaBySeat.get(i)!.userId,
      stack: s,
    }));

    // dealer must be an alive seat
    while (!alive.find((a) => a.i === dealer)) dealer = (dealer + 1) % stacks.length;

    const state = startHand(seeds, dealerIndexIn(seeds, dealer), sb, bb, handNumber);
    liveGames.set(gameId, { state, name: game.name });
    await prisma.game.update({ where: { id: gameId }, data: { handNumber } });
    io.to(room(gameId)).emit("game:hand_start", jsonSafe({ gameId, state: redact(state) }));
    await sleep(delay);

    // betting loop
    while (!handOver(state)) {
      if (state.toAct === -1) {
        if (bettingRoundComplete(state)) advanceStreet(state);
        else break;
        io.to(room(gameId)).emit("game:street", jsonSafe({ gameId, state: redact(state) }));
        await sleep(delay);
        continue;
      }

      const meta = state.seats[state.toAct]
        ? metaBySeat.get(state.seats[state.toAct].seatIndex)!
        : null;
      if (!meta) break;

      const action = await decideAction(state, meta.prompt, meta.params);
      const actorSeat = state.seats[state.toAct];
      applyAction(state, action);

      await prisma.decision.create({
        data: {
          gameId,
          agentId: meta.id,
          handNumber,
          street: state.street,
          action: action.type,
          amount: BigInt(Math.round(action.amount || 0)),
          reasoning: action.reasoning ?? "",
          engine: action.engine ?? "simulated",
        },
      });

      io.to(room(gameId)).emit("game:action", jsonSafe({
        gameId,
        seatIndex: actorSeat.seatIndex,
        agentName: meta.name,
        action: action.type,
        amount: action.amount,
        reasoning: action.reasoning,
        engine: action.engine,
        state: redact(state),
      }));
      await sleep(delay);

      if (bettingRoundComplete(state) && !handOver(state)) {
        advanceStreet(state);
        io.to(room(gameId)).emit("game:street", jsonSafe({ gameId, state: redact(state) }));
        await sleep(delay);
      }
    }

    // ran out of betting but multiple live: deal remaining streets to showdown
    while ((state.street as string) !== "showdown" && liveSeats(state).length > 1) {
      advanceStreet(state);
    }

    const result = settle(state);
    // write back stacks
    for (const s of state.seats) stacks[s.seatIndex] = s.stack;
    io.to(room(gameId)).emit("game:showdown", jsonSafe({
      gameId,
      result,
      state: revealAll(state),
    }));

    // update agent stats
    for (const s of state.seats) {
      const won = result.winners.some((w) => w.seatIndex === s.seatIndex);
      await prisma.agent.update({
        where: { id: s.agentId },
        data: {
          handsPlayed: { increment: 1 },
          handsWon: won ? { increment: 1 } : undefined,
        },
      });
    }

    dealer = (dealer + 1) % stacks.length;
    await sleep(delay * 3.5); // let spectators see the showdown result
  }

  await finishGame(io, gameId, stacks, metaBySeat, buyIn);
}

function dealerIndexIn(seeds: SeatSeed[], dealerSeatIndex: number): number {
  const idx = seeds.findIndex((s) => s.seatIndex === dealerSeatIndex);
  return idx >= 0 ? idx : 0;
}

async function finishGame(
  io: Server,
  gameId: string,
  stacks: number[],
  metaBySeat: Map<number, AgentMeta>,
  buyIn: number,
) {
  // settle economics: each agent's net chip P&L converts to money and is
  // credited to the fielding user + shared across that agent's investors.
  let winnerAgent: string | null = null;
  let best = -1;
  const summary: any[] = [];

  for (const [seatIndex, meta] of metaBySeat) {
    const finalStack = stacks[seatIndex] ?? 0;
    const netChips = finalStack - buyIn;
    if (finalStack > best) {
      best = finalStack;
      winnerAgent = meta.id;
    }
    const netMicro = BigInt(Math.round(netChips)) * CHIP_VALUE_MICRO;

    // persist the agent's final stack for this game (powers per-agent history/charts)
    await prisma.seat.updateMany({ where: { gameId, seatIndex }, data: { stack: BigInt(Math.round(finalStack)) } });

    await prisma.agent.update({
      where: { id: meta.id },
      data: { netProfit: { increment: netMicro } },
    });

    // credit fielding user
    if (meta.userId) {
      await prisma.user.update({
        where: { id: meta.userId },
        data: { balance: { increment: netMicro } },
      });
      await prisma.transaction.create({
        data: {
          userId: meta.userId,
          type: netChips >= 0 ? "winnings" : "loss",
          amount: netMicro < 0n ? -netMicro : netMicro, // store magnitude; type carries the sign
          meta: JSON.stringify({ gameId, agentId: meta.id, netChips }),
        },
      });
    }

    // share with investors of this agent (proportional to staked amount)
    const investments = await prisma.investment.findMany({ where: { agentId: meta.id } });
    const totalStaked = investments.reduce((acc, inv) => acc + inv.amount, 0n);
    if (totalStaked > 0n && netMicro !== 0n) {
      for (const inv of investments) {
        const share = (netMicro * inv.amount) / totalStaked;
        await prisma.user.update({
          where: { id: inv.userId },
          data: { balance: { increment: share } },
        });
        await prisma.transaction.create({
          data: {
            userId: inv.userId,
            type: netChips >= 0 ? "winnings" : "loss",
            amount: share < 0n ? -share : share, // store magnitude; type carries the sign
            meta: JSON.stringify({ gameId, agentId: meta.id, viaInvestment: true }),
          },
        });
      }
    }

    summary.push({ agentId: meta.id, agentName: meta.name, finalStack, netChips });
  }

  // Real multiplayer ELO update from the finishing order (pairwise, K=24).
  await updateElo(summary);

  await prisma.game.update({
    where: { id: gameId },
    data: { status: "finished", winnerAgent, finishedAt: new Date() },
  });
  liveGames.delete(gameId);
  io.to(room(gameId)).emit("game:finished", jsonSafe({ gameId, winnerAgent, summary }));
}

// Standard pairwise multiplayer ELO from finishing chip counts.
async function updateElo(summary: { agentId: string; finalStack: number }[]) {
  if (summary.length < 2) return;
  const agents = await prisma.agent.findMany({
    where: { id: { in: summary.map((s) => s.agentId) } },
    select: { id: true, elo: true },
  });
  const eloOf = new Map(agents.map((a) => [a.id, a.elo]));
  const K = 24;
  const deltas = new Map<string, number>();
  for (const a of summary) {
    let delta = 0;
    for (const b of summary) {
      if (a.agentId === b.agentId) continue;
      const ea = 1 / (1 + 10 ** ((eloOf.get(b.agentId)! - eloOf.get(a.agentId)!) / 400));
      const sa = a.finalStack > b.finalStack ? 1 : a.finalStack === b.finalStack ? 0.5 : 0;
      delta += K * (sa - ea);
    }
    deltas.set(a.agentId, Math.round(delta / (summary.length - 1)));
  }
  for (const [id, d] of deltas) {
    await prisma.agent.update({ where: { id }, data: { elo: (eloOf.get(id) ?? 1500) + d } });
  }
}

function safeParams(raw: string): AgentParams {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export const room = (gameId: string) => `game:${gameId}`;

// PaiPalace is fully transparent: agents are autonomous, so all hole cards are
// shown live. We also translate internal array indices (dealer/toAct) into the
// stable seatIndex the client renders by, and surface the blind positions.
function viewState(state: HandState, logLen = 12): any {
  const n = state.seats.length;
  const seatAt = (i: number) => state.seats[((i % n) + n) % n]?.seatIndex ?? -1;
  return {
    ...state,
    toAct: state.toAct >= 0 ? state.seats[state.toAct].seatIndex : -1,
    dealerSeat: seatAt(state.dealer),
    sbSeat: seatAt(state.dealer + 1),
    bbSeat: seatAt(state.dealer + 2),
    log: state.log.slice(-logLen),
  };
}

const redact = (state: HandState) => viewState(state, 12);
const revealAll = (state: HandState) => viewState(state, 16);
