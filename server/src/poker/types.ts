export type Suit = "s" | "h" | "d" | "c";
export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";
export type Card = `${Rank}${Suit}`;

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";
export type ActionType = "fold" | "check" | "call" | "bet" | "raise" | "allin";

export interface PlayerAction {
  type: ActionType;
  amount: number; // chips put in for this action (additional to current bet)
  reasoning?: string;
  engine?: "claude" | "simulated";
}

export interface SeatState {
  seatIndex: number;
  agentId: string;
  agentName: string;
  userId?: string | null;
  hole: Card[];
  stack: number;
  committed: number; // chips committed this street
  totalCommitted: number; // chips committed this hand
  folded: boolean;
  allIn: boolean;
  acted: boolean; // has acted since the last aggressive action this street
  lastAction?: { type: ActionType; amount: number }; // most recent action this street
  isWinner?: boolean;
}

export interface HandState {
  handNumber: number;
  street: Street;
  board: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  toAct: number; // seatIndex whose turn it is, -1 if none
  seats: SeatState[];
  dealer: number;
  smallBlind: number;
  bigBlind: number;
  log: string[];
}
