import { PrismaClient } from "@prisma/client";
import { createGame, runGameHeadless } from "../src/game/manager.js";

const prisma = new PrismaClient();

// Official "house" agents — real definitions only. No fabricated stats:
// every hand, win rate, P&L and ELO below is produced by actually playing.
const AGENTS = [
  { name: "Maverick", prompt: "You are an aggressive, fearless player. Apply maximum pressure, 3-bet light, and bluff often on scary boards. You'd rather win small pots uncontested than see showdowns.", params: { aggression: 0.85, bluffFreq: 0.35, tightness: 0.25, riskTolerance: 0.8, betSizing: 0.7, contBet: 0.8, callingTendency: 0.3, trapping: 0.1 } },
  { name: "The Rock", prompt: "You are an ultra-tight, disciplined player. Only play premium hands, never bluff, and fold marginal spots. Patience is your edge — let opponents make mistakes.", params: { aggression: 0.35, bluffFreq: 0.03, tightness: 0.85, riskTolerance: 0.3, betSizing: 0.45, contBet: 0.45, callingTendency: 0.15, trapping: 0.35 } },
  { name: "Probability Prime", prompt: "You are a GTO-leaning solver. Make balanced decisions based on pot odds, equity and ranges. Mix bluffs and value to stay unexploitable. Avoid emotional plays.", params: { aggression: 0.6, bluffFreq: 0.2, tightness: 0.5, riskTolerance: 0.55, betSizing: 0.6, contBet: 0.65, callingTendency: 0.35, trapping: 0.25 } },
  { name: "Loose Cannon", prompt: "You are a wild gambler. Play lots of hands, chase draws, and gamble for big pots. High variance is fine — you live for the rush.", params: { aggression: 0.7, bluffFreq: 0.4, tightness: 0.15, riskTolerance: 0.9, betSizing: 0.8, contBet: 0.7, callingTendency: 0.45, trapping: 0.1 } },
  { name: "Cold Calculator", prompt: "You are a methodical, math-first player. Call only when pot odds justify it, value bet thinly, and never pay off obvious strength. Minimize losses.", params: { aggression: 0.45, bluffFreq: 0.08, tightness: 0.65, riskTolerance: 0.4, betSizing: 0.5, contBet: 0.55, callingTendency: 0.25, trapping: 0.3 } },
  { name: "Bluff Baron", prompt: "You are a master of deception. Represent strong hands, barrel multiple streets, and pick off opponents who show weakness. Story-telling is everything.", params: { aggression: 0.8, bluffFreq: 0.45, tightness: 0.3, riskTolerance: 0.75, betSizing: 0.75, contBet: 0.8, callingTendency: 0.3, trapping: 0.15 } },
  { name: "Steady Eddie", prompt: "You are a solid, low-variance grinder. Play a tight-aggressive style, avoid coin flips, and grind small consistent edges. Survival first.", params: { aggression: 0.5, bluffFreq: 0.12, tightness: 0.6, riskTolerance: 0.45, betSizing: 0.55, contBet: 0.6, callingTendency: 0.3, trapping: 0.25 } },
  { name: "Riverboat", prompt: "You are a tricky, unpredictable player who loves to trap. Slow-play monsters, check-raise rivers, and let opponents hang themselves. Deception over aggression.", params: { aggression: 0.55, bluffFreq: 0.25, tightness: 0.45, riskTolerance: 0.6, betSizing: 0.55, contBet: 0.55, callingTendency: 0.4, trapping: 0.4 } },
];

// deterministic pseudo-random so seeding is repeatable without Math.random bias
let s = 12345;
const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T,>(arr: T[], n: number) => [...arr].sort(() => rand() - 0.5).slice(0, n);

async function main() {
  console.log("Seeding PaiPalace (real data only — no fabricated stats)…");

  // reset agents & games but PRESERVE user accounts and their transaction history
  await prisma.decision.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.game.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.agent.deleteMany();

  const created: { id: string; name: string }[] = [];
  for (const a of AGENTS) {
    const agent = await prisma.agent.create({
      data: {
        name: a.name,
        prompt: a.prompt,
        params: JSON.stringify(a.params),
        forSale: ["Bluff Baron", "Riverboat"].includes(a.name),
        price: ["Bluff Baron", "Riverboat"].includes(a.name) ? 250_000_000n : 0n, // $250
        // stats left at defaults (0 / ELO 1500) — earned by playing below
      },
    });
    created.push({ id: agent.id, name: agent.name });
  }

  // Play REAL headless games so every stat shown in the app is genuine.
  const NUM_GAMES = 10;
  for (let g = 0; g < NUM_GAMES; g++) {
    const field = pick(created, 4);
    const game = await createGame({
      name: `Seeding Table ${g + 1}`,
      buyInChips: 1000,
      smallBlind: 5,
      bigBlind: 10,
      agents: field.map((a) => ({ agentId: a.id })), // house agents, no fielding user
    });
    await runGameHeadless(game.id);
    process.stdout.write(`  played game ${g + 1}/${NUM_GAMES}\r`);
  }

  const agents = await prisma.agent.findMany({ orderBy: { netProfit: "desc" } });
  const decisions = await prisma.decision.count();
  console.log(`\nSeeded ${created.length} agents. Played ${NUM_GAMES} real games → ${decisions} real decisions.`);
  console.log("Leaderboard (real P&L):");
  for (const a of agents) {
    console.log(`  ${a.name.padEnd(20)} hands ${String(a.handsPlayed).padStart(3)}  win ${(a.handsPlayed ? (a.handsWon / a.handsPlayed) * 100 : 0).toFixed(0)}%  ELO ${a.elo}  P&L $${(Number(a.netProfit) / 1e6).toFixed(2)}`);
  }
  console.log("\nNo demo users/transactions seeded — register an account to create real activity.");
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
