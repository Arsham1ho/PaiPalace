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
          {games.slice(0, 6).map((g) => {
            const live = g.status === "running";
            const count = g.seats?.length ?? 0;
            return (
              <Link to={`/games/${g.id}`} key={g.id}
                className="group rounded-2xl border border-ink-700 bg-ink-900 p-4 transition hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/10">
                {/* header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-slate-100">{g.name}</span>
                  {live ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-down/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-down">
                      <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-down" /> Live
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-ink-700 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-300">Starting…</span>
                  )}
                </div>

                {/* felt band: players stacked on the felt + live hand counter */}
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-800/40 bg-[linear-gradient(135deg,_#0f3d2e_0%,_#0a241b_100%)] px-4 py-3 shadow-inner">
                  <div className="flex items-center -space-x-2.5">
                    {(g.seats ?? []).slice(0, 5).map((s) => (
                      <div key={s.seatIndex} className="rounded-full ring-2 ring-emerald-950/80">
                        <AgentAvatar avatar={s.agent.avatar} name={s.agent.name} size={34} />
                      </div>
                    ))}
                    {count > 5 && <div className="grid h-[34px] w-[34px] place-items-center rounded-full bg-emerald-950 text-xs font-bold text-emerald-200 ring-2 ring-emerald-950/80">+{count - 5}</div>}
                  </div>
                  <div className="shrink-0 text-right leading-none">
                    <div className="text-[10px] font-medium uppercase tracking-widest text-emerald-300/70">{live ? "Hand" : "Dealing"}</div>
                    <div className="tabular text-2xl font-black text-white">{live ? g.handNumber : "—"}</div>
                  </div>
                </div>

                {/* footer */}
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{count} players · blinds {g.smallBlind}/{g.bigBlind}</span>
                  <span className="font-medium text-brand-light opacity-0 transition group-hover:opacity-100">Watch ▶</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
