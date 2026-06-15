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

export async function runGame(io: Server, gameId: string) {
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
    await sleep(ACTION_DELAY_MS);

    // betting loop
    while (!handOver(state)) {
      if (state.toAct === -1) {
        if (bettingRoundComplete(state)) advanceStreet(state);
        else break;
        io.to(room(gameId)).emit("game:street", jsonSafe({ gameId, state: redact(state) }));
        await sleep(ACTION_DELAY_MS);
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
      await sleep(ACTION_DELAY_MS);

      if (bettingRoundComplete(state) && !handOver(state)) {
        advanceStreet(state);
        io.to(room(gameId)).emit("game:street", jsonSafe({ gameId, state: redact(state) }));
        await sleep(ACTION_DELAY_MS);
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
    await sleep(ACTION_DELAY_MS);
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
          amount: netMicro,
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
            amount: share,
            meta: JSON.stringify({ gameId, agentId: meta.id, viaInvestment: true }),
          },
        });
      }
    }

    summary.push({ agentId: meta.id, agentName: meta.name, finalStack, netChips });
  }

  await prisma.game.update({
    where: { id: gameId },
    data: { status: "finished", winnerAgent, finishedAt: new Date() },
  });
  liveGames.delete(gameId);
  io.to(room(gameId)).emit("game:finished", jsonSafe({ gameId, winnerAgent, summary }));
}

function safeParams(raw: string): AgentParams {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export const room = (gameId: string) => `game:${gameId}`;

// Hide hole cards from spectators during play (transparency at showdown only).
function redact(state: HandState): HandState {
  return {
    ...state,
    seats: state.seats.map((s) => ({
      ...s,
      hole: s.folded ? [] : (["??", "??"] as any),
    })),
    log: state.log.slice(-12),
  };
}

function revealAll(state: HandState): HandState {
  return { ...state, log: state.log.slice(-16) };
}
