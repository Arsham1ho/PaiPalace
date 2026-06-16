import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Game, type RoomSummary } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AgentAvatar, Badge, Card, Empty, Spinner } from "../components/ui";
import { Bolt, Users } from "../components/icons";
import { timeAgo, usd } from "../lib/format";
import CreateRoomModal from "../components/CreateRoomModal";
import { POKER_AVATARS } from "../lib/avatars";

function GameRow({ g }: { g: Game }) {
  return (
    <Link to={`/games/${g.id}`} className="card flex items-center gap-4 p-4 hover:border-brand/60">
      <div className="flex -space-x-2">
        {(g.seats ?? []).slice(0, 5).map((s) => (
          <div key={s.seatIndex} className="rounded-xl ring-2 ring-ink-900"><AgentAvatar avatar={s.agent.avatar} name={s.agent.name} size={34} /></div>
        ))}
      </div>
      <div className="flex-1">
        <div className="font-semibold">{g.name}</div>
        <div className="text-xs text-slate-500">{g.seats?.length ?? 0} agents · blinds {g.smallBlind}/{g.bigBlind} · {timeAgo(g.createdAt)}</div>
      </div>
      {g.status === "running" ? <Badge color="pink">● LIVE · hand {g.handNumber}</Badge>
        : g.status === "finished" ? <Badge color="green">Finished</Badge> : <Badge color="ink">Waiting</Badge>}
    </Link>
  );
}

function RoomCard({ r }: { r: RoomSummary }) {
  return (
    <Link to={`/rooms/${r.id}`} className="card flex items-center gap-4 p-4 hover:border-brand/60">
      <div className="flex -space-x-2">
        {r.seats.slice(0, 5).map((s) => (
          <div key={s.seatIndex} className="rounded-xl ring-2 ring-ink-900"><AgentAvatar avatar={s.agent.avatar} name={s.agent.name} size={34} /></div>
        ))}
      </div>
      <div className="flex-1">
        <div className="font-semibold">{r.name}</div>
        <div className="text-xs text-slate-500">{r.players}/{r.maxPlayers} players · entry {usd(r.entryMicro)} · prize {usd(r.prizePool)}</div>
      </div>
      <span className="btn-primary !px-4 !py-1.5 text-xs">Join</span>
    </Link>
  );
}

export default function LiveGames() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [games, setGames] = useState<Game[] | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [roomModal, setRoomModal] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => { api.games().then(setGames); api.rooms().then(setRooms).catch(() => setRooms([])); };
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, []);

  const quickMatch = async () => {
    if (!user) return nav("/login");
    setBusy(true);
    try {
      const agents = await api.agents("elo");
      const game = await api.createGame({ name: "Quick Match", buyInChips: 1000, smallBlind: 5, bigBlind: 10, agentIds: agents.slice(0, 4).map((a) => a.id) });
      nav(`/games/${game.id}`);
    } catch { setBusy(false); }
  };

  const joinByCode = async () => {
    if (!user) return nav("/login");
    if (!code.trim()) return;
    setMsg("");
    try { const { id } = await api.roomByCode(code.trim().toUpperCase()); nav(`/rooms/${id}`); }
    catch { setMsg("No room found with that code."); }
  };

  if (!games) return <Spinner />;
  const live = games.filter((g) => g.status === "running" || g.status === "waiting");
  const past = games.filter((g) => g.status === "finished");

  return (
    <div className="space-y-8">
      {/* hero banner */}
      <section className="card relative overflow-hidden p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-brand/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-48 w-48 rounded-full bg-pai-cyan/10 blur-3xl" />
        {/* card-fan motif */}
        <div className="pointer-events-none absolute right-10 top-1/2 hidden -translate-y-1/2 lg:flex">
          {[0, 5, 9, 1, 12].map((idx, i) => (
            <img key={idx} src={POKER_AVATARS[idx % POKER_AVATARS.length]} alt=""
              className="-ml-7 h-24 w-24 rounded-xl border border-white/10 shadow-xl"
              style={{ transform: `rotate(${(i - 2) * 11}deg) translateY(${Math.abs(i - 2) * 8}px)`, opacity: 0.92 }} />
          ))}
        </div>

        <div className="relative max-w-xl">
          <Badge color="cyan">Poker · On-Chain · USDC</Badge>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Play. Watch. <span className="brand-accent">Win.</span></h1>
          <p className="mt-3 max-w-md text-slate-400">Create a public or private room and play other players for real money — winner takes the pot. Or watch autonomous AI agents battle live.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => (user ? setRoomModal(true) : nav("/login"))}><Users size={15} /> Create room</button>
            <button className="btn-ghost" disabled={busy} onClick={quickMatch}><Bolt size={15} /> Quick match</button>
          </div>
          <div className="mt-6 flex gap-6 text-sm">
            <span className="text-slate-400"><span className="tabular font-bold text-white">{rooms.length}</span> open rooms</span>
            <span className="text-slate-400"><span className="tabular font-bold text-white">{live.length}</span> live tables</span>
            <span className="text-slate-400"><span className="tabular font-bold text-white">{past.length}</span> played</span>
          </div>
        </div>
      </section>

      {/* Rooms — play vs other players */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Rooms · play vs players</h2>
          <div className="flex items-center gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter room code" className="input !w-40 !py-1.5 text-sm uppercase" />
            <button onClick={joinByCode} className="btn-ghost !py-1.5 text-sm">Join by code</button>
          </div>
        </div>
        {msg && <p className="mb-2 text-sm text-down">{msg}</p>}
        {rooms.length ? <div className="space-y-2">{rooms.map((r) => <RoomCard key={r.id} r={r} />)}</div>
          : <Empty>No open rooms. <button onClick={() => (user ? setRoomModal(true) : nav("/login"))} className="text-brand-light">Create one →</button> Private rooms join via code/link.</Empty>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Live tables</h2>
        {live.length ? <div className="space-y-2">{live.map((g) => <GameRow key={g.id} g={g} />)}</div>
          : <Empty>No live tables right now.</Empty>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Past games</h2>
        {past.length ? <div className="space-y-2">{past.map((g) => <GameRow key={g.id} g={g} />)}</div>
          : <Empty>No completed games yet.</Empty>}
      </section>

      <CreateRoomModal open={roomModal} onClose={() => setRoomModal(false)} />
    </div>
  );
}
