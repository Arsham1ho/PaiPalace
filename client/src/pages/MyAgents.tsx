import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Agent } from "../lib/api";
import { AgentAvatar, Badge, Card, Empty, ProfitText, Spinner, WinRate } from "../components/ui";
import { Cpu, Play, Dots } from "../components/icons";
import { usd, pct } from "../lib/format";

export default function MyAgents() {
  const nav = useNavigate();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [menu, setMenu] = useState<string | null>(null);

  const load = () => api.myAgents().then(setAgents).catch(() => setAgents([]));
  useEffect(() => { load(); }, []);

  const sell = async (a: Agent) => {
    setMenu(null); setMsg("");
    if (a.forSale) {
      if (!window.confirm(`Unlist ${a.name} from the marketplace?`)) return;
      try { await api.updateAgent(a.id, { forSale: false }); await load(); setMsg(`${a.name} unlisted.`); } catch (e: any) { setMsg(e.message); }
      return;
    }
    const input = window.prompt(`List "${a.name}" for sale — price in USD (you're paid when it sells):`, String(Math.round((a.price || 0) / 1e6) || 100));
    if (input == null) return;
    const price = Number(input);
    if (!(price >= 0)) { setMsg("Enter a valid price."); return; }
    try { await api.updateAgent(a.id, { forSale: true, priceUsd: price }); await load(); setMsg(`${a.name} listed for $${price}.`); } catch (e: any) { setMsg(e.message); }
  };
  const remove = async (a: Agent) => {
    setMenu(null); setMsg("");
    if (!window.confirm(`Delete "${a.name}" permanently? This cannot be undone.`)) return;
    try { await api.deleteAgent(a.id); await load(); setMsg(`${a.name} deleted.`); } catch (e: any) { setMsg(e.message); }
  };

  const startTable = async (a: Agent) => {
    setBusy(a.id); setMsg("");
    try {
      const all = await api.agents("elo");
      const others = all.filter((x) => x.id !== a.id).slice(0, 3).map((x) => x.id);
      const game = await api.createGame({ name: `${a.name}'s Table`, buyInChips: 1000, smallBlind: 5, bigBlind: 10, agentIds: [a.id, ...others] });
      nav(`/games/${game.id}`);
    } catch (e: any) { setMsg(e.message); setBusy(""); }
  };

  const testMatch = async (a: Agent) => {
    setBusy(a.id); setMsg("");
    try { const game = await api.testMatch(a.id); nav(`/games/${game.id}`); }
    catch (e: any) { setMsg(e.message); setBusy(""); }
  };

  if (!agents) return <Spinner />;

  const created = agents.filter((a) => !a.bought);
  const bought = agents.filter((a) => a.bought);

  const Grid = ({ items }: { items: Agent[] }) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => (
        <Card key={a.id} className="relative flex flex-col">
          {/* three-dot menu */}
          <div className="absolute right-3 top-3 z-20">
            <button onClick={() => setMenu(menu === a.id ? null : a.id)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-ink-800 hover:text-slate-100" aria-label="Agent options">
              <Dots size={18} />
            </button>
            {menu === a.id && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-2xl">
                  <button onClick={() => { setMenu(null); nav(`/agents/${a.id}`); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-ink-800">View reasoning</button>
                  <button onClick={() => { setMenu(null); nav(`/agents/${a.id}/edit`); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-ink-800">Edit</button>
                  <button onClick={() => sell(a)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-ink-800">{a.forSale ? "Unlist from sale" : "Take out money"}</button>
                  <div className="my-1 h-px bg-ink-700" />
                  <button onClick={() => remove(a)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-down hover:bg-ink-800">Delete</button>
                </div>
              </>
            )}
          </div>

          <Link to={`/agents/${a.id}`} className="flex items-center gap-3 pr-8">
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
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled={!!busy} onClick={() => startTable(a)} className="btn-ghost justify-center !py-1.5 text-xs"><Play size={13} /> Live</button>
            <button disabled={!!busy} onClick={() => testMatch(a)} className="btn-primary justify-center !py-1.5 text-xs">{busy === a.id ? "…" : "Test $5"}</button>
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
      {msg && <p className="rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{msg}</p>}
      <p className="-mt-4 text-xs text-slate-500">Test match: field your agent vs the house AI for a flat <span className="text-slate-300">5 USDC</span> — no real winnings or losses, pure practice.</p>

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
