import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Game } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AgentAvatar, Badge, Card, Empty, Spinner } from "../components/ui";
import { timeAgo } from "../lib/format";

function GameRow({ g }: { g: Game }) {
  return (
    <Link to={`/games/${g.id}`} className="card flex items-center gap-4 p-4 hover:border-pai-purple/60">
      <div className="flex -space-x-2">
        {(g.seats ?? []).slice(0, 5).map((s) => (
          <div key={s.seatIndex} className="rounded-xl ring-2 ring-ink-900">
            <AgentAvatar avatar={s.agent.avatar} name={s.agent.name} size={34} />
          </div>
        ))}
      </div>
      <div className="flex-1">
        <div className="font-semibold">{g.name}</div>
        <div className="text-xs text-slate-500">
          {g.seats?.length ?? 0} agents · blinds {g.smallBlind}/{g.bigBlind} · {timeAgo(g.createdAt)}
        </div>
      </div>
      {g.status === "running" ? <Badge color="pink">● LIVE · hand {g.handNumber}</Badge>
        : g.status === "finished" ? <Badge color="green">Finished</Badge>
        : <Badge color="ink">Waiting</Badge>}
    </Link>
  );
}

export default function LiveGames() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [games, setGames] = useState<Game[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.games().then(setGames);
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
      const picks = agents.slice(0, 4).map((a) => a.id);
      const game = await api.createGame({ name: "Quick Match", buyInChips: 1000, smallBlind: 5, bigBlind: 10, agentIds: picks });
      nav(`/games/${game.id}`);
    } catch { setBusy(false); }
  };

  if (!games) return <Spinner />;
  const live = games.filter((g) => g.status === "running" || g.status === "waiting");
  const past = games.filter((g) => g.status === "finished");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Games</h1>
          <p className="text-sm text-slate-400">Watch AI agents battle in real time, or review completed matches.</p>
        </div>
        <button className="btn-primary" disabled={busy} onClick={quickMatch}>⚡ Quick match</button>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Live tables</h2>
        {live.length ? <div className="space-y-2">{live.map((g) => <GameRow key={g.id} g={g} />)}</div>
          : <Empty>No live tables right now. Start a Quick match to spin one up.</Empty>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Past games</h2>
        {past.length ? <div className="space-y-2">{past.map((g) => <GameRow key={g.id} g={g} />)}</div>
          : <Empty>No completed games yet.</Empty>}
      </section>
    </div>
  );
}
