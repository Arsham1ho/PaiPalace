import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Card } from "../components/ui";

const EMOJIS = ["🤖", "🦅", "🪨", "🎭", "💥", "🧮", "🛡️", "🚤", "🦈", "🃏", "👑", "🔥", "🐉", "⚡"];

function Slider({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-300">{label}</span>
        <span className="text-pai-cyan">{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-pai-pink" />
      <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

export default function CreateAgent() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🤖");
  const [prompt, setPrompt] = useState("You are a disciplined, math-driven poker player. Play tight-aggressive, value bet strong hands, and only bluff when the story makes sense. Avoid big gambles without an edge.");
  const [p, setP] = useState({ aggression: 0.5, bluffFreq: 0.15, tightness: 0.6, riskTolerance: 0.5 });
  const [forSale, setForSale] = useState(false);
  const [priceUsd, setPriceUsd] = useState(100);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const agent = await api.createAgent({ name, avatar, prompt, params: p, forSale, priceUsd });
      nav(`/agents/${agent.id}`);
    } catch (e: any) {
      setErr(typeof e.message === "string" ? e.message : "Failed to create agent");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-extrabold">Create an AI agent</h1>
      <p className="mt-1 text-sm text-slate-400">
        Write a strategy prompt and tune the parameters. When you field your agent, these drive its real-time decisions
        {" "}(via Claude when an API key is configured, otherwise the built-in strategy engine).
      </p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        <Card>
          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Avatar</label>
              <div className="grid w-44 grid-cols-7 gap-1">
                {EMOJIS.map((e) => (
                  <button type="button" key={e} onClick={() => setAvatar(e)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg ${avatar === e ? "bg-pai-purple/40 ring-1 ring-pai-purple" : "bg-ink-800"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Agent name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stone Cold Solver" minLength={2} required />
            </div>
          </div>
        </Card>

        <Card>
          <label className="mb-1 block text-xs text-slate-400">Strategy prompt</label>
          <textarea className="input min-h-[140px] resize-y" value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
          <p className="mt-1 text-[11px] text-slate-500">{prompt.length} / 2000 characters</p>
        </Card>

        <Card className="space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Parameters</h2>
          <Slider label="Aggression" value={p.aggression} onChange={(v) => setP({ ...p, aggression: v })} hint="How often it bets/raises vs calls." />
          <Slider label="Bluff frequency" value={p.bluffFreq} onChange={(v) => setP({ ...p, bluffFreq: v })} hint="Chance to bluff with weak holdings." />
          <Slider label="Tightness" value={p.tightness} onChange={(v) => setP({ ...p, tightness: v })} hint="How strong a hand it needs to continue." />
          <Slider label="Risk tolerance" value={p.riskTolerance} onChange={(v) => setP({ ...p, riskTolerance: v })} hint="Willingness to commit a big stack." />
        </Card>

        <Card>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={forSale} onChange={(e) => setForSale(e.target.checked)} className="h-4 w-4 accent-pai-pink" />
            <span className="text-sm">List this agent for sale on the marketplace</span>
          </label>
          {forSale && (
            <div className="mt-3">
              <label className="mb-1 block text-xs text-slate-400">Sale price (USD)</label>
              <input type="number" min={0} className="input w-40" value={priceUsd} onChange={(e) => setPriceUsd(Number(e.target.value))} />
            </div>
          )}
        </Card>

        {err && <p className="text-sm text-down">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create agent"}</button>
      </form>
    </div>
  );
}
