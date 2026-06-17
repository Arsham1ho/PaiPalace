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
  // professional tuning
  threeBetFreq?: number;      // 0..1 — preflop re-raise frequency
  positionAwareness?: number; // 0..1 — play wider in late position, tighter OOP
  potControl?: number;        // 0..1 — keep pots small with medium made hands
  foldDiscipline?: number;    // 0..1 — fold correctly to big bets
  valueBetting?: number;      // 0..1 — bet good-but-not-great hands for thin value
}

const RANK_VAL: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

const SUIT_SYM: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
const prettyCard = (c: Card) => `${c[0]}${SUIT_SYM[c[1]] ?? c[1]}`;
const prettyCards = (cs: Card[]) => cs.map(prettyCard).join(" ");

/** Plain-English label for a starting hand (preflop). */
function startingHandNote(hole: Card[]): string {
  const [a, b] = hole;
  const hi = Math.max(RANK_VAL[a[0] as Rank], RANK_VAL[b[0] as Rank]);
  const lo = Math.min(RANK_VAL[a[0] as Rank], RANK_VAL[b[0] as Rank]);
  const suited = a[1] === b[1];
  if (a[0] === b[0]) return hi >= 12 ? "a premium pocket pair" : hi >= 8 ? "a solid pocket pair" : "a small pocket pair";
  const broadway = lo >= 10;
  const connected = hi - lo === 1;
  if (broadway && suited) return "suited broadway cards";
  if (broadway) return "two broadway cards";
  if (suited && connected) return "a suited connector";
  if (suited) return "suited cards";
  if (connected) return "connectors";
  return hi >= 13 ? "a high card with a weak kicker" : "a speculative offsuit hand";
}

/** Map a 0..1 strength estimate to a word. */
function strengthWord(s: number): string {
  if (s >= 0.82) return "a monster";
  if (s >= 0.62) return "a strong hand";
  if (s >= 0.45) return "a playable hand";
  if (s >= 0.3) return "a marginal holding";
  return "a weak hand";
}

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
  // professional tuning
  const threeBetFreq = params.threeBetFreq ?? 0.25;
  const positionAwareness = params.positionAwareness ?? 0.5;
  const potControl = params.potControl ?? 0.45;
  const foldDiscipline = params.foldDiscipline ?? 0.55;
  const valueBetting = params.valueBetting ?? 0.5;

  // position: 0 = first to act (out of position), 1 = on the button (in position)
  const nSeats = state.seats.length;
  const lateness = nSeats > 1 ? ((state.toAct - state.dealer - 1 + nSeats) % nSeats) / (nSeats - 1) : 0.5;
  const posAdj = (lateness - 0.5) * positionAwareness; // <0 early, >0 late

  const potOdds = la.callAmount / Math.max(1, state.pot + la.callAmount);
  // tighter players + low calling tendency need a stronger hand to continue;
  // late position loosens the requirement, early position tightens it.
  const continueThreshold = Math.max(0.05, 0.22 + tightness * 0.35 - callingTendency * 0.18 - posAdj * 0.16);
  const bluffing = Math.random() < bluffFreq && postflop;
  const veryStrong = strength > continueThreshold + 0.3;

  // ── compose a human-readable "thought" describing the read ──
  const made = postflop ? evaluateBest([...seat.hole, ...state.board]).name.toLowerCase() : "";
  const read = postflop
    ? `${prettyCards(seat.hole)} on ${prettyCards(state.board)} — that's ${made}, ${strengthWord(strength)} on this ${state.street}.`
    : `${prettyCards(seat.hole)} preflop — ${startingHandNote(seat.hole)}, ${strengthWord(strength)}.`;
  const price = la.callAmount > 0
    ? ` Facing a bet: calling costs ${la.callAmount} into a ${state.pot} pot (~${Math.round(potOdds * 100)}% pot odds).`
    : "";
  const reason = (plan: string) => `${read}${price} ${plan}`;

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
      return { type: "check", amount: 0, engine: "simulated", reasoning: reason("I'll slow-play it — checking to induce a bet and trap rather than scare them off.") };
    }
    let betProb = aggression * (postflop ? 0.6 + contBet * 0.6 : 1);
    // value betting widens the betting range (thinner value); pot control reins it
    // in with medium-strength made hands to keep the pot small.
    const valueThreshold = continueThreshold + 0.12 - valueBetting * 0.1;
    const mediumMade = postflop && strength > continueThreshold && !veryStrong;
    if (mediumMade) betProb *= 1 - potControl * 0.5;
    const worthBetting = strength > valueThreshold || bluffing;
    if (worthBetting && Math.random() < betProb) {
      return { type: "bet", amount: sizedRaise(state.pot || state.bigBlind), engine: "simulated",
        reasoning: reason(bluffing ? "No real equity, but I'll fire a bluff to apply pressure and fold out better hands."
          : postflop ? "I'm ahead, so I'll continuation-bet for value and build the pot." : "Strong enough to open — raising to take the lead and thin the field.") };
    }
    return { type: "check", amount: 0, engine: "simulated", reasoning: reason("Not worth betting here — I'll check to control the pot size and see a free card.") };
  }

  // ── facing a bet ──
  const effStrength = bluffing ? Math.max(strength, 0.55) : strength;
  // calling stations call wider; nits fold more to the price. Fold discipline
  // raises the bar further against large bets relative to the pot.
  const pressure = Math.min(1, la.callAmount / Math.max(1, state.pot)); // bet size vs pot
  const callFloor = Math.max(continueThreshold, potOdds * (1.0 - callingTendency * 0.4)) + pressure * foldDiscipline * 0.18;
  if (effStrength < callFloor && !bluffing) {
    return { type: "fold", amount: 0, engine: "simulated", reasoning: reason("That's too rich for this holding — I don't have the equity to continue, so I'm folding.") };
  }

  // trap with monsters: just call to keep them in
  if (veryStrong && Math.random() < trapping) {
    return { type: "call", amount: la.callAmount, engine: "simulated", reasoning: reason("I'm way ahead — just flat-calling to disguise my strength and keep them betting into me.") };
  }

  // preflop 3-bet: re-raise decent hands at the configured frequency
  const threeBetting = !postflop && la.canRaise && strength > continueThreshold + 0.1 && Math.random() < threeBetFreq;
  if (la.canRaise && (veryStrong || bluffing || threeBetting) && Math.random() < Math.max(aggression, threeBetting ? 0.8 : 0)) {
    return { type: "raise", amount: sizedRaise(state.pot + la.callAmount), engine: "simulated",
      reasoning: reason(bluffing ? "Turning my hand into a semi-bluff raise — fold equity now plus outs if called."
        : threeBetting ? "Strong enough to 3-bet — re-raising preflop to build the pot and seize the initiative."
        : "I'm ahead of their range, so I'll raise for value and get more chips in while I'm winning.") };
  }

  return { type: "call", amount: la.callAmount, engine: "simulated", reasoning: reason("The price is right — I've got enough equity to call and continue.") };
}
