import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AccountRow } from "../lib/api";
import { Spinner } from "../components/ui";
import { usd, shortAddr } from "../lib/format";

const userAvatar = (seed: string) => `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}`;

const PERIODS = [
  { key: "day", label: "Today" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "all", label: "All" },
];

function Profit({ micro }: { micro: number }) {
  const up = micro >= 0;
  return <span className={up ? "text-up" : "text-down"}>{up ? "+" : ""}{usd(micro)}</span>;
}

export default function Players() {
  const [rows, setRows] = useState<AccountRow[] | null>(null);
  const [period, setPeriod] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    setRows(null);
    api.leaderboard(period).then(setRows).catch(() => setRows([]));
  }, [period]);

  const filtered = (rows ?? []).filter((r) => r.username.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Leaderboard</h1>
      <p className="text-sm text-slate-400">Top accounts by profit. Everything is transparent — open any player to see their full history.</p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-ink-850 p-1">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${period === p.key ? "bg-ink-700 text-white" : "text-slate-400 hover:text-slate-200"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <input className="input !w-56" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!rows ? <div className="mt-6"><Spinner /></div> : (
        <div className="card mt-4 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Profit / Loss</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">Volume</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">Agents</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-b border-ink-800/70 last:border-0 hover:bg-ink-850/50">
                  <td className="px-4 py-3 font-mono text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link to={`/players/${r.id}`} className="flex items-center gap-3">
                      <img src={userAvatar(r.username)} alt="" className="h-8 w-8 rounded-full border border-ink-700 bg-ink-800" />
                      <div>
                        <div className="font-semibold text-slate-100 hover:text-brand-light">{r.username}</div>
                        <div className="font-mono text-[11px] text-slate-500">{shortAddr(r.walletAddress) || "no wallet"}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold"><Profit micro={r.profit} /></td>
                  <td className="hidden px-4 py-3 text-right text-slate-400 sm:table-cell">{usd(r.volume)}</td>
                  <td className="hidden px-4 py-3 text-right text-slate-400 sm:table-cell">{r.agents}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No players found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
