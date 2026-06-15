import type { Card, Rank } from "./types.js";

const RANK_ORDER: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A",
];
const rankValue = (r: Rank): number => RANK_ORDER.indexOf(r) + 2; // 2..14

export interface HandRank {
  category: number; // 8 straight flush ... 0 high card
  tiebreak: number[]; // descending kickers
  name: string;
}

const CATEGORY_NAMES = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
];

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  const combo: T[] = [];
  const helper = (start: number) => {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1);
      combo.pop();
    }
  };
  helper(0);
  return result;
}

function rankFive(cards: Card[]): HandRank {
  const ranks = cards.map((c) => rankValue(c[0] as Rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c[1]);
  const isFlush = suits.every((s) => s === suits[0]);

  // straight detection (with wheel A-2-3-4-5)
  const uniq = [...new Set(ranks)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5;
  }

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // sort by count desc then rank desc
  const grouped = [...counts.entries()].sort((a, b) =>
    b[1] - a[1] || b[0] - a[0],
  );
  const pattern = grouped.map((g) => g[1]).join("");
  const kickers = grouped.map((g) => g[0]);

  if (straightHigh && isFlush) return cat(8, [straightHigh]);
  if (pattern === "41") return cat(7, kickers);
  if (pattern === "32") return cat(6, kickers);
  if (isFlush) return cat(5, ranks);
  if (straightHigh) return cat(4, [straightHigh]);
  if (pattern === "311") return cat(3, kickers);
  if (pattern === "221") return cat(2, kickers);
  if (pattern === "2111") return cat(1, kickers);
  return cat(0, ranks);

  function cat(category: number, tiebreak: number[]): HandRank {
    return { category, tiebreak, name: CATEGORY_NAMES[category] };
  }
}

export function compareHandRank(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Best 5-card rank from up to 7 cards. */
export function evaluateBest(cards: Card[]): HandRank {
  if (cards.length < 5) return rankFive([...cards, ...cards].slice(0, 5));
  let best: HandRank | null = null;
  for (const combo of combinations(cards, 5)) {
    const r = rankFive(combo);
    if (!best || compareHandRank(r, best) > 0) best = r;
  }
  return best!;
}
