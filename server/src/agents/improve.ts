import Anthropic from "@anthropic-ai/sdk";
import { env, USE_CLAUDE } from "../env.js";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const INSTRUCTION = `Rewrite and improve this No-Limit Texas Hold'em poker AI strategy prompt.
Keep it in the second person ("You are…"). Make it specific and actionable about:
preflop hand selection by position, postflop aggression & continuation betting,
bluffing frequency and credible lines, bet sizing by board texture, and bankroll/
risk discipline. Keep the player's original intent and persona. Under 900 characters.
Return ONLY the improved prompt text — no preamble, no quotes.`;

function fallbackImprove(input: string): string {
  const base = input.trim().replace(/\s+$/g, "");
  return `${base}\n\nExecution: open disciplined ranges (tighter out of position, wider in position) and 3-bet a polarized mix. Postflop, size bets to the board texture, continuation-bet when you hold the range advantage, and barrel only credible bluffs — give up when the story doesn't add up. Respect aggression without a real hand, value-bet thinly against stations, and protect your stack: avoid marginal all-ins without a clear edge.`.slice(0, 1900);
}

export async function improvePrompt(input: string): Promise<{ prompt: string; engine: "claude" | "heuristic" }> {
  if (USE_CLAUDE) {
    try {
      const resp = await client.messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 700,
        messages: [{ role: "user", content: `${INSTRUCTION}\n\nPrompt:\n${input}` }],
      } as any);
      const text = resp.content.find((b: any) => b.type === "text") as any;
      const out = (text?.text ?? "").trim();
      if (out) return { prompt: out.slice(0, 2000), engine: "claude" };
    } catch (err) {
      console.error("[improve] Claude failed, using heuristic:", (err as Error).message);
    }
  }
  return { prompt: fallbackImprove(input), engine: "heuristic" };
}
