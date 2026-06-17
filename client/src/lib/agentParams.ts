// Canonical agent strategy parameters — shared by Create, Edit and Detail pages
// so the list never drifts. Each maps to a tunable the strategy/LLM engine reads.

export interface AgentParams {
  aggression: number;
  tightness: number;
  bluffFreq: number;
  threeBetFreq: number;
  contBet: number;
  betSizing: number;
  valueBetting: number;
  potControl: number;
  callingTendency: number;
  foldDiscipline: number;
  trapping: number;
  positionAwareness: number;
  riskTolerance: number;
}

export interface ParamSpec {
  key: keyof AgentParams;
  label: string;
  hint: string;
  pro?: boolean; // true = professional tuning added beyond the basics
}

export const PARAM_SPECS: ParamSpec[] = [
  { key: "aggression", label: "Aggression", hint: "How often it bets/raises versus calls." },
  { key: "tightness", label: "Tightness", hint: "How strong a hand it needs to enter and continue." },
  { key: "bluffFreq", label: "Bluff frequency", hint: "Chance to bluff with weak holdings." },
  { key: "threeBetFreq", label: "3-bet frequency", hint: "How often it re-raises preflop for value or as a bluff.", pro: true },
  { key: "contBet", label: "Continuation betting", hint: "How often it fires a bet after taking the lead postflop." },
  { key: "betSizing", label: "Bet sizing", hint: "Small, controlled bets vs large, pot-sized pressure." },
  { key: "valueBetting", label: "Thin value betting", hint: "Bets good-but-not-great hands for thin value.", pro: true },
  { key: "potControl", label: "Pot control", hint: "Keeps pots small with medium-strength made hands.", pro: true },
  { key: "callingTendency", label: "Calling tendency", hint: "Sticky calling station vs fold-happy nit." },
  { key: "foldDiscipline", label: "Fold discipline", hint: "Folds correctly to big bets instead of paying off.", pro: true },
  { key: "trapping", label: "Trapping / slow-play", hint: "Disguises monsters by checking/flat-calling." },
  { key: "positionAwareness", label: "Position awareness", hint: "Plays wider in late position, tighter out of position.", pro: true },
  { key: "riskTolerance", label: "Risk tolerance", hint: "Willingness to commit a big stack." },
];

export const DEFAULT_PARAMS: AgentParams = {
  aggression: 0.5, tightness: 0.5, bluffFreq: 0.15, threeBetFreq: 0.25, contBet: 0.5,
  betSizing: 0.5, valueBetting: 0.5, potControl: 0.45, callingTendency: 0.4,
  foldDiscipline: 0.55, trapping: 0.2, positionAwareness: 0.5, riskTolerance: 0.5,
};
