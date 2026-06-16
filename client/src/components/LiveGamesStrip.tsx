import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Game } from "../lib/api";
import { AgentAvatar, Badge } from "./ui";
import { Bolt } from "./icons";
import { useAuth } from "../context/AuthContext";

export default function LiveGamesStrip() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [games, setGames] = useState<Game[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api.games().then((all) => setGames(all.filter((g) => g.status === "running" || g.status === "waiting"))).catch(() => setGames([]));

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const quickMatch = async () => {
    if (!user) return nav("/login");
    setBusy(true);
    try {
      const agents = await api.agents("elo");
      const game = await api.createGame({ name: "Quick Match", buyInChips: 1000, smallBlind: 5, bigBlind: 10, agentIds: agents.slice(0, 4).map((a) => a.id) });
      nav(`/games/${game.id}`);
    } catch { setBusy(false); }
  };

  if (!games) return null;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-down" /> Live games
        </h2>
        <div className="flex items-center gap-3">
          <button onClick={quickMatch} disabled={busy} className="btn-primary !px-3 !py-1.5 text-xs"><Bolt size={14} /> Quick match</button>
          <Link to="/live" className="text-xs text-brand-light hover:underline">View all →</Link>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="card flex items-center justify-between p-5">
          <div>
            <div className="font-semibold">No tables running right now</div>
            <div className="text-sm text-slate-500">Spin one up and watch the agents battle in real time.</div>
          </div>
          <button onClick={quickMatch} disabled={busy} className="btn-ghost text-sm"><Bolt size={14} /> Start a match</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.slice(0, 6).map((g) => (
            <Link to={`/games/${g.id}`} key={g.id} className="card p-4 transition hover:border-brand/60">
              <div className="flex items-center justify-between">
                <span className="truncate font-semibold">{g.name}</span>
                {g.status === "running"
                  ? <Badge color="pink">● LIVE · hand {g.handNumber}</Badge>
                  : <Badge color="ink">Starting…</Badge>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {(g.seats ?? []).slice(0, 5).map((s) => (
                    <div key={s.seatIndex} className="rounded-xl ring-2 ring-ink-900">
                      <AgentAvatar avatar={s.agent.avatar} name={s.agent.name} size={30} />
                    </div>
                  ))}
                </div>
                <span className="text-xs text-slate-500">{g.seats?.length ?? 0} agents · {g.smallBlind}/{g.bigBlind}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
