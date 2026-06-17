import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import type { HandState, PlayerAction } from "../poker/types.js";
import { legalActions } from "../poker/engine.js";
import type { AgentParams } from "./strategy.js";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Structured-output schema constrains Claude to a valid, parseable decision.
const DECISION_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["fold", "check", "call", "raise", "allin"] },
    raiseToAmount: {
      type: "integer",
      description: "If action is 'raise', the total chip amount to raise the bet TO. 0 otherwise.",
    },
    reasoning: {
      type: "string",
      description:
        "Your read in 3-5 sentences of natural, first-person poker reasoning, like thinking out loud: " +
        "(1) what you have and the board texture, (2) what you put your opponents on, " +
        "(3) the pot odds / price if facing a bet, and (4) why this action is best. Be concrete and reference the actual cards and numbers.",
    },
  },
  required: ["action", "raiseToAmount", "reasoning"],
  additionalProperties: false,
} as const;

export function buildPrompt(state: HandState, prompt: string, params: AgentParams) {
  const seat = state.seats[state.toAct];
  const la = legalActions(state);
  const opponents = state.seats
    .filter((s) => s.seatIndex !== seat.seatIndex)
    .map((s) => `${s.agentName}: ${s.folded ? "folded" : `stack ${s.stack}, committed ${s.committed}${s.allIn ? " (ALL-IN)" : ""}`}`)
    .join("\n");

  return `You are "${seat.agentName}", a poker AI playing No-Limit Texas Hold'em.

YOUR STRATEGY (follow this persona):
${prompt}

Tunable parameters: ${JSON.stringify(params)}

CURRENT SITUATION
Street: ${state.street}
Your hole cards: ${seat.hole.join(" ")}
Community board: ${state.board.join(" ") || "(none yet)"}
Pot: ${state.pot}
Your stack: ${seat.stack}
Amount you've put in this street: ${seat.committed}
Current bet to match: ${state.currentBet}
Cost to call: ${la.callAmount}

OPPONENTS
${opponents}

LEGAL ACTIONS
- fold (always allowed)
${la.canCheck ? "- check" : ""}
${la.canCall ? `- call (costs ${la.callAmount})` : ""}
${la.canRaise ? `- raise (raise TO between ${la.minRaiseTo} and ${la.maxRaiseTo})` : ""}
- allin (commit your entire stack: total ${la.maxRaiseTo})

Decide your single best action now. If raising, set raiseToAmount to the total bet you want to raise TO (between ${la.minRaiseTo} and ${la.maxRaiseTo}).
In "reasoning", think out loud in the first person (3-5 sentences): your hand and the board, what you put opponents on, the pot odds if facing a bet, and why this line is best — referencing the actual cards and chip amounts.`;
}

export async function claudeDecision(
  state: HandState,
  prompt: string,
  params: AgentParams,
): Promise<PlayerAction> {
  const resp = await client.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: DECISION_SCHEMA } },
    messages: [{ role: "user", content: buildPrompt(state, prompt, params) }],
  } as any);

  const text = resp.content.find((b: any) => b.type === "text") as any;
  const parsed = JSON.parse(text.text) as {
    action: PlayerAction["type"] | "raise";
    raiseToAmount: number;
    reasoning: string;
  };

  const la = legalActions(state);
  const reasoning = parsed.reasoning;
  switch (parsed.action) {
    case "fold":
      return { type: "fold", amount: 0, reasoning, engine: "claude" };
    case "check":
      return la.canCheck
        ? { type: "check", amount: 0, reasoning, engine: "claude" }
        : { type: "call", amount: la.callAmount, reasoning, engine: "claude" };
    case "call":
      return la.canCall
        ? { type: "call", amount: la.callAmount, reasoning, engine: "claude" }
        : { type: "check", amount: 0, reasoning, engine: "claude" };
    case "allin":
      return { type: "allin", amount: la.maxRaiseTo, reasoning, engine: "claude" };
    case "raise":
    default:
      return {
        type: "raise",
        amount: Math.max(la.minRaiseTo, Math.min(parsed.raiseToAmount, la.maxRaiseTo)),
        reasoning,
        engine: "claude",
      };
  }
}
