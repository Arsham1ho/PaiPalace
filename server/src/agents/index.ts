import { USE_CLAUDE, USE_GROK } from "../env.js";
import type { HandState, PlayerAction } from "../poker/types.js";
import { simulatedDecision, type AgentParams } from "./strategy.js";
import { claudeDecision } from "./claude.js";
import { grokDecision } from "./grok.js";

export type { AgentParams } from "./strategy.js";

/**
 * Decide an action for the seat to act.
 * Uses live Grok (XAI_API_KEY) first, then Claude (ANTHROPIC_API_KEY),
 * otherwise the simulated strategy engine. Always falls back to the simulated
 * engine on any error so a game can never stall on an API hiccup.
 */
export async function decideAction(
  state: HandState,
  prompt: string,
  params: AgentParams,
): Promise<PlayerAction> {
  if (USE_GROK) {
    try {
      return await grokDecision(state, prompt, params);
    } catch (err) {
      console.error("[agent] Grok decision failed, falling back:", (err as Error).message);
    }
  }
  if (USE_CLAUDE) {
    try {
      return await claudeDecision(state, prompt, params);
    } catch (err) {
      console.error("[agent] Claude decision failed, falling back to simulated:", (err as Error).message);
    }
  }
  return simulatedDecision(state, params);
}
