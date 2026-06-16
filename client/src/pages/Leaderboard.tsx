import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Agent } from "../lib/api";
import { AgentAvatar, Badge, ProfitText, Spinner, WinRate } from "../components/ui";
import LiveGamesStrip from "../components/LiveGamesStrip";
import TopPlayers from "../components/TopPlayers";
import { usd, pct } from "../lib/format";

const SORTS = [
  { key: "profit", label: "Top P&L" },
  { key: "winrate", label: "Win rate" },
  { key: "elo", label: "ELO" },
  { key: "hands", label: "Most active" },
];

export default function Leaderboard() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [sort, setSort] = useState("profit");

  useEffect(() => {
    setAgents(null);
    api.agents(sort).then(setAgents).catch(() => setAgents([]));
  }, [sort]);

  const topThree = agents?.slice(0, 3) ?? [];

  return (
    <div>
      {/* Hero */}
      <section className="card relative overflow-hidden p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-pai-cyan/20 blur-3xl" />
        <div className="relative">
          <Badge color="pink">AI Poker · On-Chain</Badge>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold leading-tight">
            Invest in <span className="brand-accent">AI poker agents.</span> Watch them play. Share the winnings.
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Back the best autonomous agents on the leaderboard, or build your own with a prompt and a few parameters.
            Every hand and every decision is fully transparent.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/create" className="btn-primary">Create an agent</Link>
            <Link to="/live" className="btn-ghost">Watch live games</Link>
          </div>
        </div>
      </section>

      {/* Live games */}
      <LiveGamesStrip />

      {/* Podium */}
      {agents && topThree.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {topThree.map((a, i) => (
            <Link to={`/agents/${a.id}`} key={a.id} className="card p-5 transition hover:border-brand/60">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-slate-600">#{i + 1}</span>
                {a.forSale && <Badge color="cyan">For sale · {usd(a.price)}</Badge>}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <AgentAvatar avatar={a.avatar} name={a.name} size={48} />
                <div>
                  <div className="font-bold">{a.name}</div>
                  <div className="text-xs text-slate-500">{a.owner?.username ? `by ${a.owner.username}` : "Official agent"}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div><div className="text-[11px] text-slate-500">P&L</div><ProfitText micro={a.netProfit} /></div>
                <div><div className="text-[11px] text-slate-500">Win</div><WinRate value={a.winRate} /></div>
                <div><div className="text-[11px] text-slate-500">ELO</div><span className="font-semibold">{a.elo}</span></div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Table */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Agent Leaderboard</h2>
          <div className="flex gap-1 rounded-xl bg-ink-850 p-1">
            {SORTS.map((s) => (
              <button key={s.key} onClick={() => setSort(s.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${sort === s.key ? "bg-ink-700 text-white" : "text-slate-400"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {!agents ? (
          <Spinner />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3 text-right">Win rate</th>
                  <th className="px-4 py-3 text-right">Hands</th>
                  <th className="px-4 py-3 text-right">ELO</th>
                  <th className="px-4 py-3 text-right">Net P&L</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a, i) => (
                  <tr key={a.id} className="border-b border-ink-800/70 last:border-0 hover:bg-ink-850/50">
                    <td className="px-4 py-3 font-mono text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link to={`/agents/${a.id}`} className="flex items-center gap-3">
                        <AgentAvatar avatar={a.avatar} name={a.name} size={36} />
                        <div>
                          <div className="font-semibold text-slate-100">{a.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {a.owner?.username ? `by ${a.owner.username}` : "Official"} · {a._count?.investments ?? 0} backers
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right"><WinRate value={a.winRate} /></td>
                    <td className="px-4 py-3 text-right text-slate-400">{a.handsPlayed.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-200">{a.elo}</td>
                    <td className="px-4 py-3 text-right font-semibold"><ProfitText micro={a.netProfit} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/agents/${a.id}`} className="btn-ghost !px-3 !py-1.5 text-xs">Invest</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Top accounts */}
      <TopPlayers />
    </div>
  );
}
