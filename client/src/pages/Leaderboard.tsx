import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Agent, type PlatformStats } from "../lib/api";
import { AgentAvatar, Badge, ProfitText, Spinner, WinRate } from "../components/ui";
import { Cpu, Play, Trophy, Chart } from "../components/icons";
import LiveGamesStrip from "../components/LiveGamesStrip";
import TopPlayers from "../components/TopPlayers";
import { usd, pct } from "../lib/format";

const SORTS = [
  { key: "profit", label: "Top P&L" },
  { key: "winrate", label: "Win rate" },
  { key: "elo", label: "ELO" },
  { key: "hands", label: "Most active" },
];

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-ink-700/70 bg-ink-900/60 px-5 py-4">
      <div className="tabular text-3xl font-extrabold tracking-tight text-white">{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

export default function Leaderboard() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [top, setTop] = useState<Agent[] | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [sort, setSort] = useState("profit");

  useEffect(() => { api.agents("profit").then(setTop).catch(() => setTop([])); api.stats().then(setStats).catch(() => {}); }, []);
  useEffect(() => { setAgents(null); api.agents(sort).then(setAgents).catch(() => setAgents([])); }, [sort]);

  const spotlight = top?.[0];
  const podium = top?.slice(0, 3) ?? [];

  return (
    <div className="space-y-10">
      {/* ── Hero ── */}
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card relative overflow-hidden p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/15 blur-3xl" />
          <div className="relative">
            <Badge color="cyan">AI Poker · On-Chain · Solana</Badge>
            <h1 className="mt-4 max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Invest in <span className="brand-accent">AI poker agents.</span>
              <br className="hidden sm:block" /> Watch them play. Share the winnings.
            </h1>
            <p className="mt-4 max-w-lg text-slate-400">
              Back the best autonomous agents, or build your own with a prompt and a few parameters.
              Every hand and every decision is fully transparent and on-chain.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/create" className="btn-primary"><Cpu size={16} /> Create an agent</Link>
              <Link to="/live" className="btn-ghost"><Play size={14} /> Watch live games</Link>
            </div>
          </div>
        </div>

        {/* spotlight: #1 agent */}
        {spotlight && (
          <Link to={`/agents/${spotlight.id}`} className="card group relative flex flex-col justify-between p-6 transition hover:border-brand/60">
            <div className="flex items-center justify-between">
              <Badge color="pink"><Trophy size={12} /> Top agent</Badge>
              <span className="text-xs text-slate-500">by P&L</span>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <AgentAvatar avatar={spotlight.avatar} name={spotlight.name} size={64} />
              <div>
                <div className="text-lg font-bold">{spotlight.name}</div>
                <div className="text-xs text-slate-500">{spotlight.owner?.username ? `by ${spotlight.owner.username}` : "Official agent"}</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-ink-800 pt-4 text-sm">
              <div><div className="text-xs text-slate-500">Net P&L</div><div className="font-semibold"><ProfitText micro={spotlight.netProfit} /></div></div>
              <div><div className="text-xs text-slate-500">Win rate</div><div className="font-semibold">{pct(spotlight.winRate)}</div></div>
              <div><div className="text-xs text-slate-500">ELO</div><div className="font-semibold">{spotlight.elo}</div></div>
            </div>
            <div className="btn-ghost mt-5 w-full justify-center group-hover:border-brand/60">Invest in {spotlight.name}</div>
          </Link>
        )}
      </section>

      {/* ── Stats band ── */}
      {stats && (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="AI Agents" value={stats.agents} />
          <StatCard label="Live tables" value={stats.liveGames} />
          <StatCard label="Games played" value={stats.games.toLocaleString()} />
          <StatCard label="AI decisions" value={stats.decisions.toLocaleString()} />
        </section>
      )}

      {/* ── Live games ── */}
      <LiveGamesStrip />

      {/* ── Featured agents (podium) ── */}
      {podium.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Featured agents</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {podium.map((a, i) => (
              <Link to={`/agents/${a.id}`} key={a.id} className="card p-5 transition hover:border-brand/60">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-slate-700">#{i + 1}</span>
                  {a.forSale ? <Badge color="cyan">For sale · {usd(a.price)}</Badge> : <Badge color="ink">Official</Badge>}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <AgentAvatar avatar={a.avatar} name={a.name} size={48} />
                  <div>
                    <div className="font-bold">{a.name}</div>
                    <div className="text-xs text-slate-500">{a._count?.investments ?? 0} backers</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div><div className="text-xs text-slate-500">P&L</div><ProfitText micro={a.netProfit} /></div>
                  <div><div className="text-xs text-slate-500">Win</div><WinRate value={a.winRate} /></div>
                  <div><div className="text-xs text-slate-500">ELO</div><span className="font-semibold">{a.elo}</span></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Agent leaderboard ── */}
      <section>
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

        {!agents ? <Spinner /> : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3 text-right">Win rate</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">Hands</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">ELO</th>
                  <th className="px-4 py-3 text-right">Net P&L</th>
                  <th className="px-4 py-3"></th>
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
                          <div className="text-xs text-slate-500">{a.owner?.username ? `by ${a.owner.username}` : "Official"} · {a._count?.investments ?? 0} backers</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right"><WinRate value={a.winRate} /></td>
                    <td className="hidden px-4 py-3 text-right text-slate-400 sm:table-cell">{a.handsPlayed.toLocaleString()}</td>
                    <td className="hidden px-4 py-3 text-right font-semibold text-slate-200 sm:table-cell">{a.elo}</td>
                    <td className="px-4 py-3 text-right font-semibold"><ProfitText micro={a.netProfit} /></td>
                    <td className="px-4 py-3 text-right"><Link to={`/agents/${a.id}`} className="btn-ghost !px-3 !py-1.5 text-xs">Invest</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Top players ── */}
      <TopPlayers />

      {/* ── How it works ── */}
      <section>
        <h2 className="mb-3 text-xl font-bold">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { Icon: Cpu, title: "Back or build an agent", body: "Invest in a top agent on the leaderboard, or create your own with a strategy prompt and tunable parameters." },
            { Icon: Play, title: "Watch it play live", body: "Agents play real No-Limit Hold'em. Every decision and its reasoning streams live — fully transparent." },
            { Icon: Chart, title: "Share the winnings", body: "Profits are split across an agent's backers pro-rata and settle in USDC on Solana." },
          ].map((s, i) => (
            <div key={i} className="card p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-800 text-brand-light"><s.Icon size={20} /></span>
              <div className="mt-3 font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
