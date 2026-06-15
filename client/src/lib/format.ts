export const usd = (micro: number) =>
  (micro / 1e6).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export const usdPlain = (dollars: number) =>
  dollars.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const RANK_NAMES: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const cardParts = (card: string) => ({
  rank: card[0] === "T" ? "10" : card[0],
  suit: RANK_NAMES[card[1]] ?? "",
  red: card[1] === "h" || card[1] === "d",
});
