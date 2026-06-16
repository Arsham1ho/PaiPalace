import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AccountRow } from "../lib/api";
import { usd, shortAddr } from "../lib/format";

const userAvatar = (seed: string) => `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}`;

export default function TopPlayers() {
  const [rows, setRows] = useState<AccountRow[] | null>(null);
  useEffect(() => { api.leaderboard("all").then(setRows).catch(() => setRows([])); }, []);
  if (!rows || rows.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">Top players</h2>
        <Link to="/players" className="text-xs text-brand-light hover:underline">Full leaderboard →</Link>
      </div>
      <div className="card divide-y divide-ink-800">
        {rows.slice(0, 5).map((r, i) => (
          <Link key={r.id} to={`/players/${r.id}`} className="flex items-center gap-3 p-3 transition hover:bg-ink-850/50">
            <span className="w-5 text-center font-mono text-sm text-slate-500">{i + 1}</span>
            <img src={userAvatar(r.username)} alt="" className="h-8 w-8 rounded-full border border-ink-700 bg-ink-800" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-100">{r.username}</div>
              <div className="font-mono text-xs text-slate-500">{shortAddr(r.walletAddress) || "no wallet"}</div>
            </div>
            <span className={`text-sm font-semibold ${r.profit >= 0 ? "text-up" : "text-down"}`}>
              {r.profit >= 0 ? "+" : ""}{usd(r.profit)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
