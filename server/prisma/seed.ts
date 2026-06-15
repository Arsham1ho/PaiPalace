import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();
const USD = 1_000_000n;
const addr = () => "0x" + crypto.randomBytes(20).toString("hex");

const AGENTS = [
  {
    name: "Maverick",
    avatar: "🦅",
    prompt: "You are an aggressive, fearless player. Apply maximum pressure, 3-bet light, and bluff often on scary boards. You'd rather win small pots uncontested than see showdowns.",
    params: { aggression: 0.85, bluffFreq: 0.35, tightness: 0.25, riskTolerance: 0.8 },
    handsPlayed: 1240, handsWon: 430, netProfit: 8420, elo: 1712,
  },
  {
    name: "The Rock",
    avatar: "🪨",
    prompt: "You are an ultra-tight, disciplined player. Only play premium hands, never bluff, and fold marginal spots. Patience is your edge — let opponents make mistakes.",
    params: { aggression: 0.35, bluffFreq: 0.03, tightness: 0.85, riskTolerance: 0.3 },
    handsPlayed: 1180, handsWon: 360, netProfit: 5210, elo: 1664,
  },
  {
    name: "Probability Prime",
    avatar: "🧮",
    prompt: "You are a GTO-leaning solver. Make balanced decisions based on pot odds, equity and ranges. Mix bluffs and value to stay unexploitable. Avoid emotional plays.",
    params: { aggression: 0.6, bluffFreq: 0.2, tightness: 0.5, riskTolerance: 0.55 },
    handsPlayed: 1500, handsWon: 470, netProfit: 9980, elo: 1788,
  },
  {
    name: "Loose Cannon",
    avatar: "💥",
    prompt: "You are a wild gambler. Play lots of hands, chase draws, and gamble for big pots. High variance is fine — you live for the rush.",
    params: { aggression: 0.7, bluffFreq: 0.4, tightness: 0.15, riskTolerance: 0.9 },
    handsPlayed: 980, handsWon: 300, netProfit: -2310, elo: 1521,
  },
  {
    name: "Cold Calculator",
    avatar: "🤖",
    prompt: "You are a methodical, math-first player. Call only when pot odds justify it, value bet thinly, and never pay off obvious strength. Minimize losses.",
    params: { aggression: 0.45, bluffFreq: 0.08, tightness: 0.65, riskTolerance: 0.4 },
    handsPlayed: 1320, handsWon: 395, netProfit: 4120, elo: 1640,
  },
  {
    name: "Bluff Baron",
    avatar: "🎭",
    prompt: "You are a master of deception. Represent strong hands, barrel multiple streets, and pick off opponents who show weakness. Story-telling is everything.",
    params: { aggression: 0.8, bluffFreq: 0.45, tightness: 0.3, riskTolerance: 0.75 },
    handsPlayed: 1100, handsWon: 350, netProfit: 3360, elo: 1631,
  },
  {
    name: "Steady Eddie",
    avatar: "🛡️",
    prompt: "You are a solid, low-variance grinder. Play a tight-aggressive style, avoid coin flips, and grind small consistent edges. Survival first.",
    params: { aggression: 0.5, bluffFreq: 0.12, tightness: 0.6, riskTolerance: 0.45 },
    handsPlayed: 1410, handsWon: 420, netProfit: 6010, elo: 1675,
  },
  {
    name: "Riverboat",
    avatar: "🚤",
    prompt: "You are a tricky, unpredictable player who loves to trap. Slow-play monsters, check-raise rivers, and let opponents hang themselves. Deception over aggression.",
    params: { aggression: 0.55, bluffFreq: 0.25, tightness: 0.45, riskTolerance: 0.6 },
    handsPlayed: 1050, handsWon: 320, netProfit: 1890, elo: 1588,
  },
];

async function main() {
  console.log("Seeding PaiPalace…");

  // wipe (dev only)
  await prisma.decision.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.game.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.user.deleteMany();

  const demo = await prisma.user.create({
    data: {
      email: "demo@paipalace.io",
      username: "demo_whale",
      passwordHash: await bcrypt.hash("password123", 10),
      walletAddress: addr(),
      balance: 5000n * USD,
    },
  });
  await prisma.transaction.create({
    data: { userId: demo.id, type: "deposit", amount: 5000n * USD, txHash: "0x" + crypto.randomBytes(32).toString("hex") },
  });

  const satoshi = await prisma.user.create({
    data: {
      email: "satoshi@paipalace.io",
      username: "satoshi_plays",
      passwordHash: await bcrypt.hash("password123", 10),
      walletAddress: addr(),
      balance: 12500n * USD,
    },
  });
  await prisma.transaction.create({
    data: { userId: satoshi.id, type: "deposit", amount: 12500n * USD },
  });

  const created = [] as { id: string; name: string }[];
  for (const a of AGENTS) {
    const agent = await prisma.agent.create({
      data: {
        name: a.name,
        avatar: a.avatar,
        prompt: a.prompt,
        params: JSON.stringify(a.params),
        handsPlayed: a.handsPlayed,
        handsWon: a.handsWon,
        netProfit: BigInt(a.netProfit) * 10_000n, // chips -> micro
        elo: a.elo,
        forSale: ["Bluff Baron", "Riverboat"].includes(a.name),
        price: ["Bluff Baron", "Riverboat"].includes(a.name) ? 250n * USD : 0n,
      },
    });
    created.push({ id: agent.id, name: agent.name });
  }

  // demo user invests in two top agents
  for (const name of ["Probability Prime", "Maverick"]) {
    const ag = created.find((c) => c.name === name)!;
    await prisma.investment.create({ data: { userId: demo.id, agentId: ag.id, amount: 500n * USD, shares: 500 } });
    await prisma.transaction.create({ data: { userId: demo.id, type: "invest", amount: 500n * USD, meta: JSON.stringify({ agentId: ag.id }) } });
  }

  // a finished demo game for the "past games" page
  const p1 = created.find((c) => c.name === "Probability Prime")!;
  const p2 = created.find((c) => c.name === "Maverick")!;
  const p3 = created.find((c) => c.name === "The Rock")!;
  const game = await prisma.game.create({
    data: {
      name: "Featured Table #1", status: "finished", smallBlind: 5n, bigBlind: 10n,
      buyIn: 1000n, potTotal: 3000n, handNumber: 18, winnerAgent: p1.id, finishedAt: new Date(),
    },
  });
  const seats = [p1, p2, p3];
  for (let i = 0; i < seats.length; i++) {
    await prisma.seat.create({ data: { gameId: game.id, agentId: seats[i].id, seatIndex: i, stack: i === 0 ? 1800n : 600n, startStack: 1000n } });
  }
  const sampleDecisions = [
    { agentId: p2.id, street: "preflop", action: "raise", amount: 30n, reasoning: "Opening with a wide range to apply pressure.", engine: "simulated" },
    { agentId: p1.id, street: "preflop", action: "call", amount: 30n, reasoning: "Flatting in position with a strong holding.", engine: "simulated" },
    { agentId: p3.id, street: "preflop", action: "fold", amount: 0n, reasoning: "Hand below my tight continuing range.", engine: "simulated" },
    { agentId: p2.id, street: "flop", action: "bet", amount: 45n, reasoning: "Continuation betting on a favorable board.", engine: "simulated" },
    { agentId: p1.id, street: "flop", action: "raise", amount: 140n, reasoning: "Raising for value with top pair good kicker.", engine: "simulated" },
    { agentId: p2.id, street: "flop", action: "call", amount: 95n, reasoning: "Calling to realize equity with a draw.", engine: "simulated" },
    { agentId: p2.id, street: "river", action: "fold", amount: 0n, reasoning: "Missed my draw; folding to the river barrel.", engine: "simulated" },
  ];
  for (const d of sampleDecisions) {
    await prisma.decision.create({ data: { ...d, gameId: game.id, handNumber: 12 } });
  }

  console.log(`Seeded ${created.length} agents, 2 users, 1 finished game.`);
  console.log("Demo login →  demo@paipalace.io / password123");
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
