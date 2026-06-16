import type {
  Card,
  HandState,
  PlayerAction,
  Rank,
  SeatState,
  Street,
  Suit,
} from "./types.js";
import { evaluateBest, compareHandRank } from "./evaluator.js";

const RANKS: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A",
];
const SUITS: Suit[] = ["s", "h", "d", "c"];

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(`${r}${s}` as Card);
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface SeatSeed {
  seatIndex: number;
  agentId: string;
  agentName: string;
  userId?: string | null;
  stack: number;
}

export function startHand(
  seeds: SeatSeed[],
  dealer: number,
  smallBlind: number,
  bigBlind: number,
  handNumber: number,
): HandState {
  const deck = shuffle(freshDeck());
  const seats: SeatState[] = seeds.map((s) => ({
    seatIndex: s.seatIndex,
    agentId: s.agentId,
    agentName: s.agentName,
    userId: s.userId ?? null,
    hole: [deck.pop()!, deck.pop()!],
    stack: s.stack,
    committed: 0,
    totalCommitted: 0,
    folded: false,
    allIn: false,
    acted: false,
  }));

  const state: HandState = {
    handNumber,
    street: "preflop",
    board: [],
    pot: 0,
    currentBet: 0,
    minRaise: bigBlind,
    toAct: -1,
    seats,
    dealer,
    smallBlind,
    bigBlind,
    log: [],
  };
  (state as any)._deck = deck; // stash remaining deck for street deals

  const n = seats.length;
  const sbSeat = (dealer + 1) % n;
  const bbSeat = (dealer + 2) % n;
  postBlind(state, sbSeat, smallBlind);
  postBlind(state, bbSeat, bigBlind);
  state.currentBet = bigBlind;
  state.minRaise = bigBlind;
  state.log.push(
    `Hand #${handNumber}: ${seats[sbSeat].agentName} posts SB ${smallBlind}, ${seats[bbSeat].agentName} posts BB ${bigBlind}`,
  );
  state.toAct = nextActor(state, bbSeat);
  return state;
}

function postBlind(state: HandState, seatIndex: number, amount: number) {
  const seat = state.seats[seatIndex];
  const put = Math.min(amount, seat.stack);
  seat.stack -= put;
  seat.committed += put;
  seat.totalCommitted += put;
  state.pot += put;
  if (seat.stack === 0) seat.allIn = true;
}

/** Seats still able to take an action (not folded, not all-in). */
function actingSeats(state: HandState): SeatState[] {
  return state.seats.filter((s) => !s.folded && !s.allIn);
}

/** Seats still in the hand (not folded). */
export function liveSeats(state: HandState): SeatState[] {
  return state.seats.filter((s) => !s.folded);
}

function nextActor(state: HandState, from: number): number {
  const n = state.seats.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    const s = state.seats[idx];
    if (s.folded || s.allIn) continue;
    if (!s.acted || s.committed < state.currentBet) return idx;
  }
  return -1;
}

export interface LegalActions {
  canCheck: boolean;
  callAmount: number; // chips to call
  canCall: boolean;
  canRaise: boolean;
  minRaiseTo: number; // total bet size to raise to
  maxRaiseTo: number;
}

export function legalActions(state: HandState): LegalActions {
  const seat = state.seats[state.toAct];
  const callAmount = Math.min(state.currentBet - seat.committed, seat.stack);
  const canCheck = state.currentBet === seat.committed;
  const maxRaiseTo = seat.committed + seat.stack;
  const minRaiseTo = Math.min(state.currentBet + state.minRaise, maxRaiseTo);
  return {
    canCheck,
    callAmount,
    canCall: callAmount > 0,
    canRaise: maxRaiseTo > state.currentBet,
    minRaiseTo,
    maxRaiseTo,
  };
}

/** Apply a validated action for the seat currently to act. */
export function applyAction(state: HandState, action: PlayerAction): void {
  const seat = state.seats[state.toAct];
  const la = legalActions(state);
  let desc = "";

  switch (action.type) {
    case "fold":
      seat.folded = true;
      desc = "folds";
      break;
    case "check":
      desc = "checks";
      break;
    case "call": {
      const put = la.callAmount;
      commit(state, seat, put);
      desc = `calls ${put}`;
      break;
    }
    case "bet":
    case "raise":
    case "allin": {
      // action.amount = target total bet (raise-to); clamp to legal band
      let raiseTo = action.type === "allin" ? la.maxRaiseTo : action.amount;
      raiseTo = Math.max(la.minRaiseTo, Math.min(raiseTo, la.maxRaiseTo));
      const put = raiseTo - seat.committed;
      const raiseSize = raiseTo - state.currentBet;
      if (raiseSize >= state.minRaise) state.minRaise = raiseSize;
      commit(state, seat, put);
      state.currentBet = Math.max(state.currentBet, seat.committed);
      // a genuine raise reopens the action
      for (const s of state.seats) if (s !== seat && !s.folded && !s.allIn) s.acted = false;
      desc = seat.allIn ? `is all-in for ${seat.committed}` : `raises to ${seat.committed}`;
      break;
    }
  }

  seat.acted = true;
  seat.lastAction = {
    type: action.type,
    amount: action.type === "fold" || action.type === "check" ? 0 : seat.committed,
  };
  state.log.push(`${seat.agentName} ${desc}`);
  state.toAct = nextActor(state, state.toAct);
}

function commit(state: HandState, seat: SeatState, chips: number) {
  const put = Math.min(chips, seat.stack);
  seat.stack -= put;
  seat.committed += put;
  seat.totalCommitted += put;
  state.pot += put;
  if (seat.stack === 0) seat.allIn = true;
}

export function bettingRoundComplete(state: HandState): boolean {
  if (state.toAct === -1) return true;
  if (actingSeats(state).length <= 1) {
    // only one (or zero) player can still act — round is over once they've matched
    const remaining = actingSeats(state);
    if (remaining.length === 0) return true;
    return remaining[0].committed >= state.currentBet && remaining[0].acted;
  }
  return false;
}

export function handOver(state: HandState): boolean {
  return liveSeats(state).length <= 1 || state.street === "showdown";
}

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river", "showdown"];

export function advanceStreet(state: HandState): void {
  const deck: Card[] = (state as any)._deck;
  // reset per-street state
  for (const s of state.seats) {
    s.committed = 0;
    s.acted = false;
    s.lastAction = undefined;
  }
  state.currentBet = 0;
  state.minRaise = state.bigBlind;

  const next = STREET_ORDER[STREET_ORDER.indexOf(state.street) + 1];
  state.street = next;
  if (next === "flop") state.board.push(deck.pop()!, deck.pop()!, deck.pop()!);
  else if (next === "turn") state.board.push(deck.pop()!);
  else if (next === "river") state.board.push(deck.pop()!);

  if (next !== "showdown") {
    state.log.push(`--- ${next.toUpperCase()} --- ${state.board.join(" ")}`);
    state.toAct = nextActor(state, state.dealer);
  } else {
    state.toAct = -1;
  }
}

export interface HandResult {
  winners: { seatIndex: number; agentId: string; amount: number; hand: string }[];
  pot: number;
}

/** Distribute the pot (with side pots) to the best hands. Mutates stacks. */
export function settle(state: HandState): HandResult {
  const live = liveSeats(state);
  const results: HandResult = { winners: [], pot: state.pot };

  if (live.length === 1) {
    const w = live[0];
    w.stack += state.pot;
    w.isWinner = true;
    results.winners.push({
      seatIndex: w.seatIndex,
      agentId: w.agentId,
      amount: state.pot,
      hand: "uncontested",
    });
    state.log.push(`${w.agentName} wins ${state.pot} (everyone else folded)`);
    state.pot = 0;
    return results;
  }

  // Build side pots from distinct totalCommitted levels across ALL seats.
  const contenders = state.seats.filter((s) => !s.folded);
  const ranked = new Map<number, ReturnType<typeof evaluateBest>>();
  for (const s of contenders) {
    ranked.set(s.seatIndex, evaluateBest([...s.hole, ...state.board]));
  }

  const levels = [...new Set(state.seats.map((s) => s.totalCommitted))]
    .filter((l) => l > 0)
    .sort((a, b) => a - b);

  let prev = 0;
  const awarded = new Map<number, number>();
  for (const level of levels) {
    const slice = level - prev;
    // everyone who committed at least `level` contributes `slice` to this pot
    const contributors = state.seats.filter((s) => s.totalCommitted >= level);
    const potSize = slice * contributors.length;
    // eligible winners: contenders who reached this level
    const eligible = contenders.filter((s) => s.totalCommitted >= level);
    if (eligible.length > 0 && potSize > 0) {
      let best = ranked.get(eligible[0].seatIndex)!;
      for (const s of eligible) {
        const r = ranked.get(s.seatIndex)!;
        if (compareHandRank(r, best) > 0) best = r;
      }
      const pwinners = eligible.filter(
        (s) => compareHandRank(ranked.get(s.seatIndex)!, best) === 0,
      );
      const share = Math.floor(potSize / pwinners.length);
      for (const w of pwinners) {
        awarded.set(w.seatIndex, (awarded.get(w.seatIndex) ?? 0) + share);
      }
    }
    prev = level;
  }

  for (const [seatIndex, amount] of awarded) {
    const seat = state.seats.find((s) => s.seatIndex === seatIndex)!;
    seat.stack += amount;
    seat.isWinner = true;
    results.winners.push({
      seatIndex,
      agentId: seat.agentId,
      amount,
      hand: ranked.get(seatIndex)!.name,
    });
    state.log.push(
      `${seat.agentName} wins ${amount} with ${ranked.get(seatIndex)!.name}`,
    );
  }
  state.pot = 0;
  return results;
}
