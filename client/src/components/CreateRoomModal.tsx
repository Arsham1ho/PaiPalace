import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Agent } from "../lib/api";
import { AgentAvatar } from "./ui";

export default function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [agentId, setAgentId] = useState("");
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [password, setPassword] = useState("");
  const [entryUsd, setEntryUsd] = useState(5);
  const [bigBlind, setBigBlind] = useState(10);
  const [human, setHuman] = useState(true); // play manually vs let the AI agent play
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMsg("");
    api.myAgents().then((a) => { setAgents(a); if (a[0]) setAgentId(a[0].id); }).catch(() => setAgents([]));
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const create = async () => {
    if (!human && !agentId) { setMsg("Pick one of your agents for the AI to field."); return; }
    setBusy(true); setMsg("");
    try {
      const { id } = await api.createRoom({ name: name.trim() || undefined, visibility, password: password || undefined, agentId, entryUsd, smallBlind: Math.max(1, Math.floor(bigBlind / 2)), bigBlind, human });
      onClose(); nav(`/rooms/${id}`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card animate-fade w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="relative text-center">
          <h2 className="text-xl font-bold">Create a room</h2>
          <p className="mt-0.5 text-sm text-slate-400">Players each stake the entry; winner takes the pot.</p>
          <button onClick={onClose} className="absolute -right-1 -top-1 text-slate-400 hover:text-slate-100">✕</button>
        </div>

        {(
          <div className="mt-5 space-y-4">
            {/* room name */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Room name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Friday Night Showdown" />
            </div>

            {/* visibility */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-850 p-1">
              {(["public", "private"] as const).map((v) => (
                <button key={v} onClick={() => setVisibility(v)} className={`rounded-lg py-2 text-sm font-medium capitalize transition ${visibility === v ? "bg-ink-700 text-white" : "text-slate-400"}`}>{v}</button>
              ))}
            </div>

            {/* who plays this seat */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Who plays your seat?</label>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-850 p-1">
                <button onClick={() => setHuman(true)} className={`rounded-lg py-2 text-sm font-medium transition ${human ? "bg-ink-700 text-white" : "text-slate-400"}`}>I'll play</button>
                <button onClick={() => setHuman(false)} className={`rounded-lg py-2 text-sm font-medium transition ${!human ? "bg-ink-700 text-white" : "text-slate-400"}`}>My AI agent</button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{human ? "You make every decision at the table. Your agent is just your identity/avatar." : "Your AI agent plays automatically on your behalf."}</p>
            </div>

            {/* agent / table identity */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">{human ? "Your table identity (optional)" : "Your agent"}</label>
              {agents == null ? null : agents.length > 0 ? (
                <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto">
                  {agents.map((a) => (
                    <button key={a.id} onClick={() => setAgentId(a.id)}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition ${agentId === a.id ? "border-brand bg-brand/10" : "border-ink-700 hover:border-ink-600"}`}>
                      <AgentAvatar avatar={a.avatar} name={a.name} size={28} /> <span className="font-medium">{a.name}</span>
                    </button>
                  ))}
                </div>
              ) : human ? (
                <p className="text-[11px] text-slate-500">No agent needed — you'll play as yourself with a default table avatar.</p>
              ) : (
                <p className="text-sm text-slate-400">The AI needs an agent to field. <button onClick={() => { onClose(); nav("/create"); }} className="text-brand-light">Create one →</button></p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Entry fee (USD)</label>
                <input type="number" min={0} className="input" value={entryUsd} onChange={(e) => setEntryUsd(Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Big blind (chips)</label>
                <input type="number" min={2} className="input" value={bigBlind} onChange={(e) => setBigBlind(Number(e.target.value))} />
              </div>
            </div>

            {visibility === "private" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Password (optional)</label>
                <input type="text" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Share with friends" />
              </div>
            )}

            {msg && <p className="text-xs text-down">{msg}</p>}
            <button className="btn-primary w-full" disabled={busy || (!human && !agentId)} onClick={create}>{busy ? "Creating…" : `Create room · stake $${entryUsd}`}</button>
            <p className="text-center text-[11px] text-slate-500">Everyone gets {1000} chips. Most chips at the end wins the prize pool.</p>
          </div>
        )}
      </div>
    </div>
  );
}
