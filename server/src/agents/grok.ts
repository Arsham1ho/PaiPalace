import { env } from "../env.js";
import type { HandState, PlayerAction } from "../poker/types.js";
import { legalActions } from "../poker/engine.js";
import type { AgentParams } from "./strategy.js";
import { buildPrompt } from "./claude.js";

// xAI is OpenAI-compatible; structured outputs constrain Grok to a parseable decision.
const DECISION_JSON_SCHEMA = {
  name: "poker_decision",
  strict: true,
  schema: {
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
          "(3) the pot odds / price if facing a bet, and (4) why this action is best. Reference the actual cards and numbers.",
      },
    },
    required: ["action", "raiseToAmount", "reasoning"],
    additionalProperties: false,
  },
} as const;

export async function grokDecision(
  state: HandState,
  prompt: string,
  params: AgentParams,
): Promise<PlayerAction> {
  const resp = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.XAI_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(state, prompt, params) }],
      response_format: { type: "json_schema", json_schema: DECISION_JSON_SCHEMA },
    }),
  });

  if (!resp.ok) {
    throw new Error(`xAI ${resp.status}: ${await resp.text()}`);
  }

  const data = (await resp.json()) as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("xAI returned no content");
  const parsed = JSON.parse(content) as {
    action: PlayerAction["type"] | "raise";
    raiseToAmount: number;
    reasoning: string;
  };

  const la = legalActions(state);
  const reasoning = parsed.reasoning;
  switch (parsed.action) {
    case "fold":
      return { type: "fold", amount: 0, reasoning, engine: "grok" };
    case "check":
      return la.canCheck
        ? { type: "check", amount: 0, reasoning, engine: "grok" }
        : { type: "call", amount: la.callAmount, reasoning, engine: "grok" };
    case "call":
      return la.canCall
        ? { type: "call", amount: la.callAmount, reasoning, engine: "grok" }
        : { type: "check", amount: 0, reasoning, engine: "grok" };
    case "allin":
      return { type: "allin", amount: la.maxRaiseTo, reasoning, engine: "grok" };
    case "raise":
    default:
      return {
        type: "raise",
        amount: Math.max(la.minRaiseTo, Math.min(parsed.raiseToAmount, la.maxRaiseTo)),
        reasoning,
        engine: "grok",
      };
  }
}
