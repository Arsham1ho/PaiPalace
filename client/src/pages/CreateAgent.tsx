import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Card } from "../components/ui";
import { Cpu } from "../components/icons";
import { POKER_AVATARS, randomPokerAvatar } from "../lib/avatars";

interface Params {
  aggression: number; bluffFreq: number; tightness: number; riskTolerance: number;
  betSizing: number; contBet: number; callingTendency: number; trapping: number;
}

const PARAMS: { key: keyof Params; label: string; hint: string }[] = [
  { key: "aggression", label: "Aggression", hint: "How often it bets/raises versus calls." },
  { key: "tightness", label: "Tightness", hint: "How strong a hand it needs to enter and continue." },
  { key: "bluffFreq", label: "Bluff frequency", hint: "Chance to bluff with weak holdings." },
  { key: "betSizing", label: "Bet sizing", hint: "Small, controlled bets vs large, pot-sized pressure." },
  { key: "contBet", label: "Continuation betting", hint: "How often it fires a bet after taking the lead postflop." },
  { key: "callingTendency", label: "Calling tendency", hint: "Sticky calling station vs fold-happy nit." },
  { key: "trapping", label: "Trapping / slow-play", hint: "Disguises monsters by checking/flat-calling." },
  { key: "riskTolerance", label: "Risk tolerance", hint: "Willingness to commit a big stack." },
];

const PRESETS: { name: string; desc: string; prompt: string; params: Params }[] = [
  { name: "Tight-Aggressive", desc: "Solid, disciplined value", prompt: "You are a disciplined tight-aggressive (TAG) player. Enter pots with strong ranges, bet and raise for value, c-bet relentlessly, and bluff only when the story is credible. Fold marginal spots and avoid coin flips without an edge.", params: { aggression: 0.65, bluffFreq: 0.15, tightness: 0.7, riskTolerance: 0.5, betSizing: 0.55, contBet: 0.7, callingTendency: 0.25, trapping: 0.2 } },
  { name: "Loose-Aggressive", desc: "High-pressure LAG", prompt: "You are a loose-aggressive (LAG) player. Play a wide range, apply constant pressure with bets and 3-bets, barrel multiple streets, and bluff often. Force opponents into tough decisions and accept high variance.", params: { aggression: 0.85, bluffFreq: 0.4, tightness: 0.25, riskTolerance: 0.8, betSizing: 0.7, contBet: 0.78, callingTendency: 0.3, trapping: 0.15 } },
  { name: "GTO Balanced", desc: "Unexploitable mix", prompt: "You are a GTO-leaning solver. Make balanced decisions from pot odds, equity and ranges. Mix value and bluffs at the right frequencies to stay unexploitable, size bets by board texture, and avoid emotional plays.", params: { aggression: 0.6, bluffFreq: 0.22, tightness: 0.5, riskTolerance: 0.55, betSizing: 0.6, contBet: 0.65, callingTendency: 0.35, trapping: 0.25 } },
  { name: "The Nit", desc: "Ultra-tight rock", prompt: "You are an ultra-tight rock. Only play premium hands, almost never bluff, and fold to aggression without a strong holding. Patience is your edge — let opponents pay you off.", params: { aggression: 0.3, bluffFreq: 0.03, tightness: 0.9, riskTolerance: 0.3, betSizing: 0.45, contBet: 0.45, callingTendency: 0.15, trapping: 0.35 } },
  { name: "Maniac", desc: "Max aggression, high variance", prompt: "You are a maniac. Raise and re-raise relentlessly with a huge range, bluff constantly, and gamble for stacks. Maximum pressure, maximum variance — you live for the action.", params: { aggression: 0.95, bluffFreq: 0.55, tightness: 0.1, riskTolerance: 0.95, betSizing: 0.9, contBet: 0.85, callingTendency: 0.4, trapping: 0.05 } },
  { name: "Calling Station", desc: "Sticky, hard to bluff", prompt: "You are a calling station. Rarely fold once involved, call down with marginal hands, and let opponents bluff into you. Seldom raise — your edge is catching bluffs.", params: { aggression: 0.3, bluffFreq: 0.05, tightness: 0.3, riskTolerance: 0.5, betSizing: 0.45, contBet: 0.4, callingTendency: 0.85, trapping: 0.3 } },
];

function Slider({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="text-sm font-semibold text-brand-light">{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-brand" />
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

// resize an uploaded image to a small square data URL
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CreateAgent() {
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>(() => randomPokerAvatar()); // random poker image by default
  const [showImages, setShowImages] = useState(false);
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [activePreset, setActivePreset] = useState(0);
  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [improving, setImproving] = useState(false);
  const [p, setP] = useState<Params>(PRESETS[0].params);
  const [forSale, setForSale] = useState(false);
  const [priceUsd, setPriceUsd] = useState(100);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // debounced name-availability check
  useEffect(() => {
    const n = name.trim();
    if (n.length < 2) { setNameStatus("idle"); return; }
    setNameStatus("checking");
    const t = setTimeout(() => {
      api.checkAgentName(n).then((r) => setNameStatus(r.available ? "ok" : "taken")).catch(() => setNameStatus("idle"));
    }, 400);
    return () => clearTimeout(t);
  }, [name]);

  const applyPreset = (i: number) => { setActivePreset(i); setP({ ...PRESETS[i].params }); setPrompt(PRESETS[i].prompt); };
  const setParam = (k: keyof Params, v: number) => { setActivePreset(-1); setP((prev) => ({ ...prev, [k]: v })); };

  const improve = async () => {
    if (prompt.trim().length < 10) return;
    setImproving(true); setErr("");
    try { const r = await api.improvePrompt(prompt); setPrompt(r.prompt); setActivePreset(-1); }
    catch (e: any) { setErr(e.message); } finally { setImproving(false); }
  };

  const onUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Please choose an image file."); return; }
    try { setAvatar(await fileToAvatar(file)); } catch { setErr("Could not read that image."); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameStatus === "taken") { setErr("That agent name is taken. Choose a unique name."); return; }
    setErr(""); setBusy(true);
    try {
      const agent = await api.createAgent({ name: name.trim(), avatar, prompt, params: p, forSale, priceUsd });
      nav(`/agents/${agent.id}`);
    } catch (e: any) {
      setErr(typeof e.message === "string" ? e.message : "Failed to create agent");
      setBusy(false);
    }
  };

  const previewSrc = avatar;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight">Create an AI agent</h1>
      <p className="mt-1 text-sm text-slate-400">
        Pick a playstyle to start, then refine the strategy prompt and parameters. These drive your agent's real-time
        decisions — via Claude when an API key is configured, otherwise the built-in strategy engine.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        {/* identity */}
        <Card>
          <div className="flex items-center gap-4">
            <img src={previewSrc} alt="avatar preview" className="h-16 w-16 shrink-0 rounded-xl border border-ink-700 bg-ink-800 object-cover" />
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-400">Agent name</label>
              <div className="relative">
                <input className="input !pr-24" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stone Cold Solver" minLength={2} maxLength={40} required />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium">
                  {nameStatus === "checking" && <span className="text-slate-500">checking…</span>}
                  {nameStatus === "ok" && <span className="text-up">✓ available</span>}
                  {nameStatus === "taken" && <span className="text-down">✕ taken</span>}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Agent names are unique. Each agent gets its own ID on creation.</p>
            </div>
          </div>

          {/* agent image — two buttons; grid only shows on "Choose image" */}
          <div className="mt-5">
            <div className="flex items-center gap-2">
              <span className="mr-auto text-xs font-medium text-slate-400">Agent image</span>
              <button type="button" onClick={() => setShowImages((v) => !v)} className="btn-ghost !px-3 !py-1.5 text-xs">
                {showImages ? "Close" : "Choose image"}
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost !px-3 !py-1.5 text-xs">Upload</button>
              <button type="button" onClick={() => setAvatar(randomPokerAvatar())} className="btn-ghost !px-3 !py-1.5 text-xs">Shuffle</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
            </div>
            {showImages && (
              <div className="mt-3 grid grid-cols-8 gap-2">
                {POKER_AVATARS.map((url) => (
                  <button type="button" key={url} onClick={() => { setAvatar(url); setShowImages(false); }}
                    className={`overflow-hidden rounded-lg border ${avatar === url ? "border-brand ring-1 ring-brand" : "border-ink-700 hover:border-ink-600"}`}>
                    <img src={url} alt="" className="aspect-square w-full" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* presets */}
        <Card>
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Playstyle preset</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRESETS.map((preset, i) => (
              <button type="button" key={preset.name} onClick={() => applyPreset(i)}
                className={`rounded-xl border p-3 text-left transition ${activePreset === i ? "border-brand bg-brand/10" : "border-ink-700 bg-ink-850 hover:border-ink-600"}`}>
                <div className="text-sm font-semibold text-slate-100">{preset.name}</div>
                <div className="text-xs text-slate-500">{preset.desc}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* prompt */}
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400">Strategy prompt</label>
            <button type="button" onClick={improve} disabled={improving || prompt.trim().length < 10}
              className="btn-ghost !px-3 !py-1.5 text-xs">
              <Cpu size={14} /> {improving ? "Improving…" : "Improve with AI"}
            </button>
          </div>
          <textarea className="input min-h-[150px] resize-y" value={prompt} maxLength={2000}
            onChange={(e) => { setActivePreset(-1); setPrompt(e.target.value); }} required />
          <p className="mt-1 text-xs text-slate-500">{prompt.length} / 2000 characters · "Improve with AI" rewrites it into a sharper strategy.</p>
        </Card>

        {/* parameters */}
        <Card>
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Parameters</h2>
          <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {PARAMS.map((param) => (
              <Slider key={param.key} label={param.label} hint={param.hint} value={p[param.key]} onChange={(v) => setParam(param.key, v)} />
            ))}
          </div>
        </Card>

        {/* marketplace */}
        <Card>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={forSale} onChange={(e) => setForSale(e.target.checked)} className="h-4 w-4 accent-brand" />
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
        <button className="btn-primary w-full" disabled={busy || nameStatus === "taken"}>{busy ? "Creating…" : "Create agent"}</button>
      </form>
    </div>
  );
}
