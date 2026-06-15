import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type Agent } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AgentAvatar, Badge, Card, ProfitText, Spinner, Stat, WinRate } from "../components/ui";
import { usd, pct, timeAgo } from "../lib/format";

const PARAM_LABELS: Record<string, string> = {
  aggression: "Aggression",
  bluffFreq: "Bluff frequency",
  tightness: "Tightness",
  riskTolerance: "Risk tolerance",
};

export default function AgentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [amount, setAmount] = useState(100);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.agent(id!).then(setAgent).catch(() => setAgent(null));
  useEffect(() => { load(); }, [id]);

  if (!agent) return <Spinner />;
  const params = (() => { try { return JSON.parse(agent.params); } catch { return {}; } })();

  const invest = async () => {
    if (!user) return nav("/login");
    setBusy(true); setMsg("");
    try {
      await api.invest(agent.id, amount);
      await refresh();
      setMsg(`Invested ${usd(amount * 1e6)} in ${agent.name}.`);
      load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const buy = async () => {
    if (!user) return nav("/login");
    setBusy(true); setMsg("");
    try {
      await api.buyAgent(agent.id);
      await refresh();
      setMsg("Agent purchased — it's now yours.");
      load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const startTable = async () => {
    setBusy(true); setMsg("");
    try {
      const all = await api.agents("elo");
      const others = all.filter((a) => a.id !== agent.id).slice(0, 3).map((a) => a.id);
      const game = await api.createGame({
        name: `${agent.name}'s Table`,
        buyInChips: 1000, smallBlind: 5, bigBlind: 10,
        agentIds: [agent.id, ...others],
      });
      nav(`/games/${game.id}`);
    } catch (e: any) { setMsg(e.message); setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <div className="flex items-start gap-4">
            <AgentAvatar avatar={agent.avatar} name={agent.name} size={64} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold">{agent.name}</h1>
                {agent.forSale && <Badge color="cyan">For sale · {usd(agent.price)}</Badge>}
              </div>
              <div className="text-sm text-slate-500">
                {agent.owner?.username ? <>Owned by <Link to={`/players`} className="text-pai-cyan">{agent.owner.username}</Link></> : "Official PaiPalace agent"}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Net P&L" value={<ProfitText micro={agent.netProfit} />} />
            <Stat label="Win rate" value={pct(agent.winRate)} />
            <Stat label="Hands" value={agent.handsPlayed.toLocaleString()} />
            <Stat label="ELO" value={agent.elo} />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Gaming strategy</h2>
          <p className="mt-3 whitespace-pre-wrap text-slate-300">{agent.prompt}</p>
          <div className="mt-5 space-y-3">
            {Object.entries(PARAM_LABELS).map(([k, label]) => (
              <div key={k}>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{label}</span><span>{pct(params[k] ?? 0)}</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-ink-700">
                  <div className="h-2 rounded-full" style={{ width: `${(params[k] ?? 0) * 100}%`, backgroundImage: "linear-gradient(90deg,#ff3df0,#1fd3ff)" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Recent decisions</h2>
          <div className="mt-3 space-y-2">
            {agent.decisions?.length ? agent.decisions.map((d) => (
              <div key={d.id} className="flex items-start gap-3 rounded-lg border border-ink-800 bg-ink-850/40 p-3 text-sm">
                <Badge color={d.action === "fold" ? "red" : d.action === "raise" || d.action === "bet" || d.action === "allin" ? "pink" : "ink"}>
                  {d.action}{d.amount ? ` ${d.amount}` : ""}
                </Badge>
                <div className="flex-1">
                  <div className="text-slate-300">{d.reasoning || "—"}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {d.street} · {d.engine === "claude" ? "🧠 Claude" : "⚙️ simulated"} · {timeAgo(d.createdAt)}
                  </div>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">No decisions logged yet. Start a table to watch it play.</p>}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Invest in this agent</h2>
          <p className="mt-1 text-xs text-slate-500">Stake funds and earn a proportional share of this agent's winnings.</p>
          <div className="mt-4 flex gap-2">
            <input type="number" min={1} className="input" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <button className="btn-primary whitespace-nowrap" disabled={busy} onClick={invest}>Invest</button>
          </div>
          <div className="mt-2 flex gap-2">
            {[50, 100, 500].map((v) => (
              <button key={v} onClick={() => setAmount(v)} className="btn-ghost flex-1 !py-1.5 text-xs">${v}</button>
            ))}
          </div>
          {agent.forSale && (
            <button className="btn-ghost mt-4 w-full" disabled={busy} onClick={buy}>
              Buy agent for {usd(agent.price)}
            </button>
          )}
          <button className="btn-ghost mt-2 w-full" disabled={busy} onClick={startTable}>
            🎲 Start a live table
          </button>
          {msg && <p className="mt-3 text-center text-xs text-pai-cyan">{msg}</p>}
        </Card>

        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Backers</h2>
          <div className="mt-3 space-y-2">
            {agent.investments?.length ? agent.investments.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{inv.user?.username ?? "anon"}</span>
                <span className="font-semibold text-slate-200">{usd(inv.amount)}</span>
              </div>
            )) : <p className="text-sm text-slate-500">No backers yet — be the first.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
