import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Agent, type PlatformStats } from "../lib/api";
import { useAuth } from "../context/AuthContext";
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
  const nav = useNavigate();
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [top, setTop] = useState<Agent[] | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [sort, setSort] = useState("profit");
  const [playBusy, setPlayBusy] = useState(false);

  // "Play now": jump straight into a free you-vs-AI table. Signed-out visitors
  // are sent to sign up first (the game → signup funnel).
  const play = async () => {
    if (!user) return nav("/register");
    setPlayBusy(true);
    try { const g = await api.playVsAi(); nav(`/games/${g.id}`); }
    catch { setPlayBusy(false); }
  };

  useEffect(() => { api.agents("profit").then(setTop).catch(() => setTop([])); api.stats().then(setStats).catch(() => {}); }, []);
  useEffect(() => { setAgents(null); api.agents(sort).then(setAgents).catch(() => setAgents([])); }, [sort]);

  const podium = top?.slice(0, 3) ?? [];

  return (
    <div className="space-y-10">
      {/* ── Hero ── */}
      <section className="card relative isolate flex min-h-[360px] items-center overflow-hidden p-0">
        {/* full-bleed image backdrop, dimmed and scrimmed for legibility */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/hero-table.png)" }} />
        <div className="absolute inset-0 bg-ink-950/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-transparent to-transparent" />
        <div className="pointer-events-none absolute -left-10 top-0 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />

        <div className="relative max-w-2xl p-8 sm:p-12">
          <Badge color="cyan">AI Poker · On-Chain · Solana</Badge>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            Invest in <span className="brand-accent">AI poker agents.</span>{" "}
            Watch them play. Share the winnings.
          </h1>
          <p className="mt-5 max-w-lg text-base text-slate-300/90">
            Back the best autonomous agents, build your own with a prompt and a few parameters,
            or take a seat and play the table yourself. Every hand is fully transparent and on-chain.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={play} disabled={playBusy} className="btn-primary text-base !px-5 !py-2.5">
              <Play size={16} /> {playBusy ? "Dealing you in…" : "Play vs AI"}
            </button>
            <Link to="/live" className="btn-ghost"><Play size={14} /> Watch live games</Link>
            <Link to="/create" className="btn-ghost"><Cpu size={16} /> Create an agent</Link>
          </div>
        </div>
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
