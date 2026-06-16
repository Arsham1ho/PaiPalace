import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { api, type Agent, type AgentPerformance } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AgentAvatar, Badge, Card, ProfitText, Spinner, Stat, WinRate } from "../components/ui";
import { Play } from "../components/icons";
import { usd, usdPlain, pct, timeAgo } from "../lib/format";

const PARAM_LABELS: Record<string, string> = {
  aggression: "Aggression", bluffFreq: "Bluff frequency", tightness: "Tightness", riskTolerance: "Risk tolerance",
  betSizing: "Bet sizing", contBet: "Continuation betting", callingTendency: "Calling tendency", trapping: "Trapping / slow-play",
};

const userAvatar = (seed: string) => `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}`;

export default function AgentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [perf, setPerf] = useState<AgentPerformance | null>(null);
  const [amount, setAmount] = useState(100);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.agent(id!).then(setAgent).catch(() => setAgent(null));
  useEffect(() => { load(); api.agentPerformance(id!).then(setPerf).catch(() => setPerf(null)); }, [id]);

  if (!agent) return <Spinner />;
  const params = (() => { try { return JSON.parse(agent.params); } catch { return {}; } })();
  const rec = perf?.record;
  const gameWinRate = rec && rec.games > 0 ? rec.wins / rec.games : 0;
  const chart = (perf?.series ?? []).map((s, i) => ({ i: i + 1, value: Number((s.cumMicro / 1e6).toFixed(2)) }));

  const invest = async () => {
    if (!user) return nav("/login");
    setBusy(true); setMsg("");
    try { await api.invest(agent.id, amount); await refresh(); setMsg(`Invested ${usd(amount * 1e6)} in ${agent.name}.`); load(); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const buy = async () => {
    if (!user) return nav("/login");
    setBusy(true); setMsg("");
    try { await api.buyAgent(agent.id); await refresh(); setMsg("Agent purchased — it's now yours."); load(); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const startTable = async () => {
    setBusy(true); setMsg("");
    try {
      const all = await api.agents("elo");
      const others = all.filter((a) => a.id !== agent.id).slice(0, 3).map((a) => a.id);
      const game = await api.createGame({ name: `${agent.name}'s Table`, buyInChips: 1000, smallBlind: 5, bigBlind: 10, agentIds: [agent.id, ...others] });
      nav(`/games/${game.id}`);
    } catch (e: any) { setMsg(e.message); setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* header */}
        <Card>
          <div className="flex items-start gap-4">
            <AgentAvatar name={agent.name} size={64} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight">{agent.name}</h1>
                {agent.forSale && <Badge color="cyan">For sale · {usd(agent.price)}</Badge>}
              </div>
              <div className="text-sm text-slate-500">
                {agent.owner?.username ? <>Owned by <Link to={`/players/${agent.owner.id}`} className="text-brand-light">{agent.owner.username}</Link></> : "Official PaiPalace agent"}
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Net P&L" value={<ProfitText micro={agent.netProfit} />} />
            <Stat label="Win rate" value={pct(agent.winRate)} />
            <Stat label="Hands" value={agent.handsPlayed.toLocaleString()} />
            <Stat label="Games" value={rec?.games ?? 0} />
            <Stat label="ELO" value={agent.elo} />
          </div>
        </Card>

        {/* performance chart */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Performance</h2>
            {rec && <span className="text-xs text-slate-500">{rec.games} games · {rec.wins}W / {rec.losses}L</span>}
          </div>
          <div className="mt-4 h-56">
            {chart.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ left: -8, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222632" />
                  <XAxis dataKey="i" tick={{ fill: "#64748b", fontSize: 11 }} stroke="#222632" />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} stroke="#222632" tickFormatter={(v) => usdPlain(v)} />
                  <Tooltip contentStyle={{ background: "#13151d", border: "1px solid #2d3340", borderRadius: 12, color: "#e2e8f0" }}
                    formatter={(v: any) => [usdPlain(Number(v)), "Cumulative P&L"]} labelFormatter={(l) => `Game ${l}`} />
                  <ReferenceLine y={0} stroke="#3a4150" />
                  <Area type="monotone" dataKey="value" stroke="#2f6bff" strokeWidth={2} fill="#2f6bff" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">No game history yet. Start a table to build a track record.</div>
            )}
          </div>
          {rec && rec.games > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-ink-800 pt-4 sm:grid-cols-4">
              <Stat label="Game win rate" value={pct(gameWinRate)} />
              <Stat label="Wins" value={rec.wins} tone="up" />
              <Stat label="Losses" value={rec.losses} tone="down" />
              <Stat label="Total won" value={usd(rec.profitMicro)} tone="up" />
            </div>
          )}
        </Card>

        {/* strategy + params */}
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Gaming strategy</h2>
          <p className="mt-3 whitespace-pre-wrap text-slate-300">{agent.prompt}</p>
          <div className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {Object.entries(PARAM_LABELS).map(([k, label]) => (
              <div key={k}>
                <div className="flex justify-between text-xs text-slate-400"><span>{label}</span><span>{pct(params[k] ?? 0)}</span></div>
                <div className="mt-1 h-2 w-full rounded-full bg-ink-700">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${(params[k] ?? 0) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* recent decisions */}
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Recent decisions</h2>
          <div className="mt-3 space-y-2">
            {agent.decisions?.length ? agent.decisions.map((d) => (
              <div key={d.id} className="flex items-start gap-3 rounded-lg border border-ink-800 bg-ink-850/40 p-3 text-sm">
                <Badge color={d.action === "fold" ? "red" : ["raise", "bet", "allin"].includes(d.action) ? "pink" : "ink"}>{d.action}{d.amount ? ` ${d.amount}` : ""}</Badge>
                <div className="flex-1">
                  <div className="text-slate-300">{d.reasoning || "—"}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{d.street} · {d.engine === "claude" ? "Claude" : "Simulated"} · {timeAgo(d.createdAt)}</div>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">No decisions logged yet. Start a table to watch it play.</p>}
          </div>
        </Card>
      </div>

      {/* sidebar */}
      <div className="space-y-6">
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Invest in this agent</h2>
          <p className="mt-1 text-xs text-slate-500">Stake funds and earn a proportional share of this agent's winnings.</p>
          <div className="mt-4 flex gap-2">
            <input type="number" min={1} className="input" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <button className="btn-primary whitespace-nowrap" disabled={busy} onClick={invest}>Invest</button>
          </div>
          <div className="mt-2 flex gap-2">
            {[50, 100, 500].map((v) => <button key={v} onClick={() => setAmount(v)} className="btn-ghost flex-1 !py-1.5 text-xs">${v}</button>)}
          </div>
          {agent.forSale && <button className="btn-ghost mt-4 w-full" disabled={busy} onClick={buy}>Buy agent for {usd(agent.price)}</button>}
          <button className="btn-ghost mt-2 w-full" disabled={busy} onClick={startTable}><Play size={14} /> Start a live table</button>
          {msg && <p className="mt-3 text-center text-xs text-brand-light">{msg}</p>}
        </Card>

        {/* used by */}
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Used by</h2>
          <div className="mt-3 space-y-2">
            {agent.owner && (
              <Link to={`/players/${agent.owner.id}`} className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-ink-850">
                <img src={userAvatar(agent.owner.username)} alt="" className="h-7 w-7 rounded-full border border-ink-700" />
                <span className="text-slate-300">{agent.owner.username}</span>
                <Badge color="cyan">owner</Badge>
              </Link>
            )}
            {(agent.fielders ?? []).filter((f) => f && f.id !== agent.owner?.id).map((f) => (
              <Link key={f.id} to={`/players/${f.id}`} className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-ink-850">
                <img src={userAvatar(f.username)} alt="" className="h-7 w-7 rounded-full border border-ink-700" />
                <span className="text-slate-300">{f.username}</span>
                <span className="text-xs text-slate-500">fielded it</span>
              </Link>
            ))}
            {!agent.owner && !(agent.fielders ?? []).length && <p className="text-sm text-slate-500">Official agent — open to everyone.</p>}
          </div>
        </Card>

        {/* backers */}
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Backers</h2>
          <div className="mt-3 space-y-2">
            {agent.investments?.length ? agent.investments.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between text-sm">
                <Link to={`/players/${inv.user?.id}`} className="text-slate-300 hover:text-brand-light">{inv.user?.username ?? "anon"}</Link>
                <span className="font-semibold text-slate-200">{usd(inv.amount)}</span>
              </div>
            )) : <p className="text-sm text-slate-500">No backers yet — be the first.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
