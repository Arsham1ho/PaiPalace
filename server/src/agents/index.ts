import { USE_CLAUDE } from "../env.js";
import type { HandState, PlayerAction } from "../poker/types.js";
import { simulatedDecision, type AgentParams } from "./strategy.js";
import { claudeDecision } from "./claude.js";

export type { AgentParams } from "./strategy.js";

/**
 * Decide an action for the seat to act.
 * Uses real Claude when ANTHROPIC_API_KEY is set, otherwise the simulated
 * strategy engine. Always falls back to the simulated engine on any error so
 * a game can never stall on an API hiccup.
 */
export async function decideAction(
  state: HandState,
  prompt: string,
  params: AgentParams,
): Promise<PlayerAction> {
  if (USE_CLAUDE) {
    try {
      return await claudeDecision(state, prompt, params);
    } catch (err) {
      console.error("[agent] Claude decision failed, falling back to simulated:", (err as Error).message);
    }
  }
  return simulatedDecision(state, params);
}
