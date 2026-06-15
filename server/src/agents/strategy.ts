import type { Card, HandState, PlayerAction, Rank } from "../poker/types.js";
import { legalActions } from "../poker/engine.js";
import { evaluateBest } from "../poker/evaluator.js";

export interface AgentParams {
  aggression?: number; // 0..1 — how often to bet/raise vs call
  bluffFreq?: number; // 0..1 — chance to bluff weak hands
  tightness?: number; // 0..1 — how strong a hand it needs to continue
  riskTolerance?: number; // 0..1 — willingness to commit chips
}

const RANK_VAL: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

/** Rough 0..1 strength estimate for the current seat. */
export function estimateStrength(hole: Card[], board: Card[]): number {
  if (board.length === 0) {
    // preflop: normalized hole-card heuristic
    const [a, b] = hole;
    const r1 = RANK_VAL[a[0] as Rank];
    const r2 = RANK_VAL[b[0] as Rank];
    const high = Math.max(r1, r2);
    const low = Math.min(r1, r2);
    const pair = r1 === r2;
    const suited = a[1] === b[1];
    const connected = Math.abs(r1 - r2) === 1;
    let score = (high + low) / 28; // 0..1-ish
    if (pair) score += 0.35 + high / 50;
    if (suited) score += 0.06;
    if (connected) score += 0.04;
    return Math.max(0, Math.min(1, score));
  }
  // postflop: map made-hand category (0..8) to strength
  const rank = evaluateBest([...hole, ...board]);
  const base = rank.category / 8; // 0..1
  const kicker = (rank.tiebreak[0] ?? 0) / 14;
  return Math.max(0, Math.min(1, base * 0.85 + kicker * 0.15));
}

/** Deterministic-ish simulated decision using the agent's tunable params. */
export function simulatedDecision(
  state: HandState,
  params: AgentParams,
): PlayerAction {
  const seat = state.seats[state.toAct];
  const la = legalActions(state);
  const strength = estimateStrength(seat.hole, state.board);

  const aggression = params.aggression ?? 0.5;
  const bluffFreq = params.bluffFreq ?? 0.1;
  const tightness = params.tightness ?? 0.5;
  const risk = params.riskTolerance ?? 0.5;

  const potOdds = la.callAmount / Math.max(1, state.pot + la.callAmount);
  const continueThreshold = 0.25 + tightness * 0.35; // need this much to keep going
  const bluffing = Math.random() < bluffFreq && state.board.length >= 3;

  // Facing no bet — option to check or bet
  if (la.canCheck) {
    if (strength > continueThreshold + 0.15 || bluffing) {
      if (Math.random() < aggression) {
        const size = Math.round(state.pot * (0.4 + risk * 0.6));
        const raiseTo = Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, seat.committed + size));
        return { type: "bet", amount: raiseTo, engine: "simulated", reasoning: bluffing ? "Betting as a bluff to apply pressure." : "Value betting a strong hand." };
      }
    }
    return { type: "check", amount: 0, engine: "simulated", reasoning: "Checking to control the pot." };
  }

  // Facing a bet
  const effectiveStrength = bluffing ? Math.max(strength, 0.55) : strength;
  if (effectiveStrength < Math.max(continueThreshold, potOdds * 0.9) && !bluffing) {
    return { type: "fold", amount: 0, engine: "simulated", reasoning: "Hand too weak versus the price." };
  }

  // strong enough to raise?
  if (la.canRaise && (effectiveStrength > continueThreshold + 0.25 || bluffing) && Math.random() < aggression) {
    const size = Math.round((state.pot + la.callAmount) * (0.6 + risk * 0.7));
    const raiseTo = Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, seat.committed + size));
    return { type: "raise", amount: raiseTo, engine: "simulated", reasoning: bluffing ? "Raising as a semi-bluff." : "Raising for value." };
  }

  return { type: "call", amount: la.callAmount, engine: "simulated", reasoning: "Calling with adequate equity / odds." };
}
