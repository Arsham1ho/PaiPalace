import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Agent } from "../lib/api";
import { AgentAvatar, Badge, Card, Empty, ProfitText, Spinner, WinRate } from "../components/ui";
import { Cpu, Play } from "../components/icons";
import { usd, pct } from "../lib/format";

export default function MyAgents() {
  const nav = useNavigate();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => { api.myAgents().then(setAgents).catch(() => setAgents([])); }, []);

  const startTable = async (a: Agent) => {
    setBusy(a.id);
    try {
      const all = await api.agents("elo");
      const others = all.filter((x) => x.id !== a.id).slice(0, 3).map((x) => x.id);
      const game = await api.createGame({ name: `${a.name}'s Table`, buyInChips: 1000, smallBlind: 5, bigBlind: 10, agentIds: [a.id, ...others] });
      nav(`/games/${game.id}`);
    } catch { setBusy(""); }
  };

  if (!agents) return <Spinner />;

  const created = agents.filter((a) => !a.bought);
  const bought = agents.filter((a) => a.bought);

  const Grid = ({ items }: { items: Agent[] }) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => (
        <Card key={a.id} className="flex flex-col">
          <Link to={`/agents/${a.id}`} className="flex items-center gap-3">
            <AgentAvatar avatar={a.avatar} name={a.name} size={48} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-bold">{a.name}</span>
                {a.bought ? <Badge color="cyan">Bought</Badge> : <Badge color="ink">Created</Badge>}
              </div>
              <div className="text-xs text-slate-500">{a._count?.investments ?? 0} backers · ELO {a.elo}</div>
            </div>
          </Link>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ink-800 pt-3 text-sm">
            <div><div className="text-xs text-slate-500">P&L</div><ProfitText micro={a.netProfit} /></div>
            <div><div className="text-xs text-slate-500">Win</div><WinRate value={a.winRate} /></div>
            <div><div className="text-xs text-slate-500">Hands</div><span className="font-semibold">{a.handsPlayed}</span></div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link to={`/agents/${a.id}`} className="btn-ghost flex-1 justify-center !py-1.5 text-xs">View</Link>
            <button disabled={!!busy} onClick={() => startTable(a)} className="btn-primary flex-1 justify-center !py-1.5 text-xs"><Play size={13} /> {busy === a.id ? "…" : "Play"}</button>
          </div>
          {a.forSale && <div className="mt-2 text-center text-xs text-brand-light">Listed for {usd(a.price)}</div>}
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">My agents</h1>
          <p className="text-sm text-slate-400">Agents you've created or purchased. Field them at a table anytime.</p>
        </div>
        <Link to="/create" className="btn-primary"><Cpu size={16} /> Create agent</Link>
      </div>

      {agents.length === 0 ? (
        <Empty>You don't own any agents yet. <Link to="/create" className="text-brand-light">Create one →</Link> or <Link to="/" className="text-brand-light">buy one from the leaderboard →</Link></Empty>
      ) : (
        <>
          {created.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">Created by you <span className="text-sm font-normal text-slate-500">({created.length})</span></h2>
              <Grid items={created} />
            </section>
          )}
          {bought.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">Bought <span className="text-sm font-normal text-slate-500">({bought.length})</span></h2>
              <Grid items={bought} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
