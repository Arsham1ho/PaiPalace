import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type RoomDetail, type Agent } from "../lib/api";
import { AgentAvatar, Badge, Card, Spinner } from "../components/ui";
import { Copy } from "../components/icons";
import { usd } from "../lib/format";
import { getSocket } from "../lib/socket";

export default function Lobby() {
  const { id } = useParams();
  const nav = useNavigate();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [human, setHuman] = useState(true); // play manually vs let the AI agent play

  const load = () => api.room(id!).then((r) => {
    setRoom(r);
    if (r.status !== "lobby") nav(`/games/${r.id}`); // game started → go to table
  }).catch(() => nav("/live"));

  useEffect(() => {
    load();
    api.myAgents().then((a) => { setAgents(a); if (a[0]) setAgentId(a[0].id); }).catch(() => {});
    const t = setInterval(load, 3000);

    // real-time: refresh when players join, jump to the table when the host starts
    const socket = getSocket();
    socket.emit("game:watch", id);
    const onUpdate = () => load();
    const onStart = () => nav(`/games/${id}`);
    socket.on("room:update", onUpdate);
    socket.on("game:start", onStart);
    socket.on("game:hand_start", onStart);

    return () => {
      clearInterval(t);
      socket.emit("game:leave", id);
      socket.off("room:update", onUpdate);
      socket.off("game:start", onStart);
      socket.off("game:hand_start", onStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!room) return <Spinner />;

  const link = `${window.location.origin}/rooms/${room.id}`;
  const copy = async (text: string) => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const join = async () => {
    if (!agentId) { setMsg("Pick an agent to field."); return; }
    setBusy(true); setMsg("");
    try { await api.joinRoom(room.id, { agentId, password: password || undefined, human }); await load(); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const start = async () => {
    setBusy(true); setMsg("");
    try { await api.startRoom(room.id); /* poll will redirect to table */ }
    catch (e: any) { setMsg(e.message); setBusy(false); }
  };
  const addBot = async () => {
    setBusy(true); setMsg("");
    try { await api.addRoomBot(room.id); await load(); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const seats = [...room.players, ...Array.from({ length: room.maxPlayers - room.players.length })];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/live" className="text-xs text-slate-500 hover:text-slate-300">← Games</Link>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">{room.name}
            <Badge color={room.visibility === "private" ? "pink" : "cyan"}>{room.visibility}</Badge>
          </h1>
        </div>
        <Badge color="ink">Lobby · waiting</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><div className="text-xs uppercase tracking-wide text-slate-500">Prize pool</div><div className="tabular mt-1 text-2xl font-extrabold text-up">{usd(room.prizePool)}</div></Card>
        <Card><div className="text-xs uppercase tracking-wide text-slate-500">Entry</div><div className="tabular mt-1 text-2xl font-extrabold">{usd(room.entryMicro)}</div></Card>
        <Card><div className="text-xs uppercase tracking-wide text-slate-500">Players</div><div className="tabular mt-1 text-2xl font-extrabold">{room.players.length}/{room.maxPlayers}</div></Card>
      </div>

      {/* share */}
      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Invite players</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => copy(link)} className="btn-ghost text-xs"><Copy size={14} /> {copied ? "Copied link" : "Copy invite link"}</button>
          {room.roomCode && <span className="inline-flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-xs">Code <span className="font-mono font-bold text-slate-200">{room.roomCode}</span></span>}
        </div>
        {room.visibility === "private" && <p className="mt-2 text-[11px] text-slate-500">Private room — share the link{room.needsPassword ? " and password" : ""} so others can join.</p>}
      </Card>

      {/* seats */}
      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Table</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {seats.map((s: any, i) => s ? (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 p-3">
              <AgentAvatar avatar={s.agent.avatar} name={s.agent.name} size={32} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{s.agent.name}</div>
                <div className="truncate text-[11px] text-slate-500">{s.userId ? (s.username ?? "player") : "AI opponent"}{s.userId && s.userId === room.hostId ? " · host" : ""}</div>
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-center justify-center rounded-xl border border-dashed border-ink-700 p-3 text-xs text-slate-600">Empty seat</div>
          ))}
        </div>
      </Card>

      {/* actions */}
      <Card>
        {!room.joined ? (
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Join this room · {usd(room.entryMicro)} entry</h2>
            {agents.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">Every player fields an agent. Create one now — it takes a few seconds and you'll come straight back here to join.</p>
                <Link to={`/create?next=${encodeURIComponent(`/rooms/${room.id}`)}`} className="btn-primary inline-flex w-full justify-center">Create an agent & join →</Link>
              </div>
            ) : (
              <>
                <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {agents.map((a) => (
                    <button key={a.id} onClick={() => setAgentId(a.id)} className={`flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition ${agentId === a.id ? "border-brand bg-brand/10" : "border-ink-700 hover:border-ink-600"}`}>
                      <AgentAvatar avatar={a.avatar} name={a.name} size={26} /> <span className="truncate font-medium">{a.name}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-850 p-1">
                  <button onClick={() => setHuman(true)} className={`rounded-lg py-2 text-sm font-medium transition ${human ? "bg-ink-700 text-white" : "text-slate-400"}`}>I'll play</button>
                  <button onClick={() => setHuman(false)} className={`rounded-lg py-2 text-sm font-medium transition ${!human ? "bg-ink-700 text-white" : "text-slate-400"}`}>My AI agent</button>
                </div>
                <p className="text-center text-[11px] text-slate-500">{human ? "You make every decision at the table." : "Your AI agent plays for you automatically."}</p>
                {room.needsPassword && <input type="text" className="input" placeholder="Room password" value={password} onChange={(e) => setPassword(e.target.value)} />}
                <button className="btn-primary w-full" disabled={busy} onClick={join}>Join · stake {usd(room.entryMicro)}</button>
              </>
            )}
          </div>
        ) : room.isHost ? (
          <div className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">You're the host</h2>
            <button className="btn-primary w-full" disabled={busy || room.players.length < 2} onClick={start}>
              {room.players.length < 2 ? "Add a player or an AI opponent to start" : `Start game · ${room.players.length} players`}
            </button>
            <button className="btn-ghost w-full" disabled={busy || room.players.length >= room.maxPlayers} onClick={addBot}>+ Add AI opponent</button>
            <p className="text-center text-[11px] text-slate-500">Invite friends with the link/code, or fill seats with house AI. The prize pool always goes to the best human player.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">You're in. Waiting for the host to start the game…</p>
        )}
        {msg && <p className="mt-3 text-sm text-down">{msg}</p>}
      </Card>
    </div>
  );
}
