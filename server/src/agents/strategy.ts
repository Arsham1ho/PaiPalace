import type { Card, HandState, PlayerAction, Rank } from "../poker/types.js";
import { legalActions } from "../poker/engine.js";
import { evaluateBest } from "../poker/evaluator.js";

export interface AgentParams {
  aggression?: number;     // 0..1 — how often to bet/raise vs call
  bluffFreq?: number;      // 0..1 — chance to bluff weak hands
  tightness?: number;      // 0..1 — how strong a hand it needs to continue
  riskTolerance?: number;  // 0..1 — willingness to commit chips
  betSizing?: number;      // 0..1 — small bets vs large (pot-sized+) bets
  contBet?: number;        // 0..1 — continuation-bet frequency postflop
  callingTendency?: number; // 0..1 — sticky/calling-station vs fold-happy
  trapping?: number;       // 0..1 — slow-play strong hands to disguise them
}

const RANK_VAL: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

/** Rough 0..1 strength estimate for the current seat. */
export function estimateStrength(hole: Card[], board: Card[]): number {
  if (board.length === 0) {
    const [a, b] = hole;
    const r1 = RANK_VAL[a[0] as Rank];
    const r2 = RANK_VAL[b[0] as Rank];
    const high = Math.max(r1, r2);
    const low = Math.min(r1, r2);
    const pair = r1 === r2;
    const suited = a[1] === b[1];
    const connected = Math.abs(r1 - r2) === 1;
    let score = (high + low) / 28;
    if (pair) score += 0.35 + high / 50;
    if (suited) score += 0.06;
    if (connected) score += 0.04;
    return Math.max(0, Math.min(1, score));
  }
  const rank = evaluateBest([...hole, ...board]);
  const base = rank.category / 8;
  const kicker = (rank.tiebreak[0] ?? 0) / 14;
  return Math.max(0, Math.min(1, base * 0.85 + kicker * 0.15));
}

/** Simulated decision driven by the agent's tunable parameters. */
export function simulatedDecision(
  state: HandState,
  params: AgentParams,
): PlayerAction {
  const seat = state.seats[state.toAct];
  const la = legalActions(state);
  const strength = estimateStrength(seat.hole, state.board);
  const postflop = state.board.length >= 3;

  const aggression = params.aggression ?? 0.5;
  const bluffFreq = params.bluffFreq ?? 0.1;
  const tightness = params.tightness ?? 0.5;
  const risk = params.riskTolerance ?? 0.5;
  const betSizing = params.betSizing ?? 0.5;
  const contBet = params.contBet ?? 0.5;
  const callingTendency = params.callingTendency ?? 0.4;
  const trapping = params.trapping ?? 0.2;

  const potOdds = la.callAmount / Math.max(1, state.pot + la.callAmount);
  // tighter players + low calling tendency need a stronger hand to continue
  const continueThreshold = 0.22 + tightness * 0.35 - callingTendency * 0.18;
  const bluffing = Math.random() < bluffFreq && postflop;
  const veryStrong = strength > continueThreshold + 0.3;

  // bet size as a fraction of the pot, from the bet-sizing dial
  const sizeFrac = 0.4 + betSizing * 0.95 + risk * 0.15;
  const sizedRaise = (base: number) => {
    const target = seat.committed + Math.round(base * sizeFrac);
    return Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, target));
  };

  // ── no bet to face: check or bet ──
  if (la.canCheck) {
    // slow-play monsters sometimes (trap)
    if (veryStrong && Math.random() < trapping) {
      return { type: "check", amount: 0, engine: "simulated", reasoning: "Slow-playing a strong hand to induce action." };
    }
    let betProb = aggression * (postflop ? 0.6 + contBet * 0.6 : 1);
    const worthBetting = strength > continueThreshold + 0.12 || bluffing;
    if (worthBetting && Math.random() < betProb) {
      return { type: "bet", amount: sizedRaise(state.pot || state.bigBlind), engine: "simulated",
        reasoning: bluffing ? "Betting as a bluff to apply pressure." : postflop ? "Continuation betting for value." : "Opening with a strong holding." };
    }
    return { type: "check", amount: 0, engine: "simulated", reasoning: "Checking to control the pot." };
  }

  // ── facing a bet ──
  const effStrength = bluffing ? Math.max(strength, 0.55) : strength;
  // calling stations call wider; nits fold more to the price
  const callFloor = Math.max(continueThreshold, potOdds * (1.0 - callingTendency * 0.4));
  if (effStrength < callFloor && !bluffing) {
    return { type: "fold", amount: 0, engine: "simulated", reasoning: "Hand too weak versus the price." };
  }

  // trap with monsters: just call to keep them in
  if (veryStrong && Math.random() < trapping) {
    return { type: "call", amount: la.callAmount, engine: "simulated", reasoning: "Flat-calling to trap with a monster." };
  }

  if (la.canRaise && (veryStrong || bluffing) && Math.random() < aggression) {
    return { type: "raise", amount: sizedRaise(state.pot + la.callAmount), engine: "simulated",
      reasoning: bluffing ? "Raising as a semi-bluff." : "Raising for value." };
  }

  return { type: "call", amount: la.callAmount, engine: "simulated", reasoning: "Calling with adequate equity / odds." };
}
