import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, Spinner } from "../components/ui";
import { Cpu } from "../components/icons";
import { POKER_AVATARS, ROBOT_AVATARS, randomPokerAvatar } from "../lib/avatars";

interface Params { aggression: number; bluffFreq: number; tightness: number; riskTolerance: number; betSizing: number; contBet: number; callingTendency: number; trapping: number }
const DEFAULT_PARAMS: Params = { aggression: 0.5, bluffFreq: 0.15, tightness: 0.5, riskTolerance: 0.5, betSizing: 0.5, contBet: 0.5, callingTendency: 0.4, trapping: 0.2 };
const PARAM_DEFS: { key: keyof Params; label: string }[] = [
  { key: "aggression", label: "Aggression" }, { key: "tightness", label: "Tightness" },
  { key: "bluffFreq", label: "Bluff frequency" }, { key: "betSizing", label: "Bet sizing" },
  { key: "contBet", label: "Continuation betting" }, { key: "callingTendency", label: "Calling tendency" },
  { key: "trapping", label: "Trapping / slow-play" }, { key: "riskTolerance", label: "Risk tolerance" },
];

function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 160; const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject; img.src = reader.result as string;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

export default function EditAgent() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [origName, setOrigName] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>("");
  const [showImages, setShowImages] = useState(false);
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [prompt, setPrompt] = useState("");
  const [improving, setImproving] = useState(false);
  const [p, setP] = useState<Params>(DEFAULT_PARAMS);
  const [forSale, setForSale] = useState(false);
  const [priceUsd, setPriceUsd] = useState(100);
  const [err, setErr] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.agent(id!).then((a) => {
      if (!user || a.ownerId !== user.id) { nav(`/agents/${a.id}`); return; }
      setOrigName(a.name); setName(a.name); setAvatar(a.avatar || randomPokerAvatar());
      setPrompt(a.prompt);
      try { setP({ ...DEFAULT_PARAMS, ...JSON.parse(a.params) }); } catch {}
      setForSale(a.forSale); setPriceUsd(Math.round((a.price || 0) / 1e6) || 100);
      setLoaded(true);
    }).catch(() => nav("/my-agents"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  useEffect(() => {
    const n = name.trim();
    if (n.length < 2 || n.toLowerCase() === origName.toLowerCase()) { setNameStatus("idle"); return; }
    setNameStatus("checking");
    const t = setTimeout(() => api.checkAgentName(n).then((r) => setNameStatus(r.available ? "ok" : "taken")).catch(() => setNameStatus("idle")), 400);
    return () => clearTimeout(t);
  }, [name, origName]);

  const improve = async () => {
    if (prompt.trim().length < 10) return;
    setImproving(true); setErr("");
    try { const r = await api.improvePrompt(prompt); setPrompt(r.prompt); } catch (e: any) { setErr(e.message); } finally { setImproving(false); }
  };
  const onUpload = async (file?: File) => { if (file?.type.startsWith("image/")) { try { setAvatar(await fileToAvatar(file)); } catch {} } };

  const save = async () => {
    if (nameStatus === "taken") { setErr("That name is taken."); return; }
    setErr(""); setMsg(""); setBusy(true);
    try {
      await api.updateAgent(id!, { name: name.trim(), avatar, prompt, params: p, forSale, priceUsd });
      setMsg("Saved."); setOrigName(name.trim());
      setTimeout(() => nav(`/agents/${id}`), 600);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm("Delete this agent permanently? This cannot be undone.")) return;
    setErr(""); setBusy(true);
    try { await api.deleteAgent(id!); nav("/my-agents"); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  };

  if (!loaded) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight">Manage agent</h1>
      <p className="mt-1 text-sm text-slate-400">Edit your agent, list it for sale to cash out, or delete it.</p>

      <div className="mt-6 space-y-6">
        {/* identity + image */}
        <Card>
          <div className="flex items-center gap-4">
            <img src={avatar} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-ink-700 bg-ink-800 object-cover" />
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-400">Agent name</label>
              <div className="relative">
                <input className="input !pr-24" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium">
                  {nameStatus === "checking" && <span className="text-slate-500">checking…</span>}
                  {nameStatus === "ok" && <span className="text-up">✓ available</span>}
                  {nameStatus === "taken" && <span className="text-down">✕ taken</span>}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center gap-2">
              <span className="mr-auto text-sm font-semibold text-slate-300">Agent image</span>
              <button type="button" onClick={() => setShowImages((v) => !v)} className="btn-ghost !px-4 !py-2 text-sm">{showImages ? "Close" : "Choose image"}</button>
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost !px-4 !py-2 text-sm">Upload</button>
              <button type="button" onClick={() => setAvatar(randomPokerAvatar())} className="btn-ghost !px-4 !py-2 text-sm">Shuffle</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
            </div>
            {showImages && (
              <div className="mt-3 space-y-3">
                {[["Poker & casino", POKER_AVATARS], ["Robots", ROBOT_AVATARS]].map(([label, list]) => (
                  <div key={label as string}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label as string}</div>
                    <div className="grid grid-cols-8 gap-2 sm:grid-cols-10">
                      {(list as string[]).map((url) => (
                        <button type="button" key={url} onClick={() => { setAvatar(url); setShowImages(false); }}
                          className={`overflow-hidden rounded-lg border ${avatar === url ? "border-brand ring-1 ring-brand" : "border-ink-700 hover:border-ink-600"}`}>
                          <img src={url} alt="" className="aspect-square w-full" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* prompt */}
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400">Strategy prompt</label>
            <button type="button" onClick={improve} disabled={improving} className="btn-ghost !px-3 !py-1.5 text-xs"><Cpu size={14} /> {improving ? "Improving…" : "Improve with AI"}</button>
          </div>
          <textarea className="input min-h-[140px] resize-y" value={prompt} maxLength={2000} onChange={(e) => setPrompt(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">{prompt.length} / 2000 characters</p>
        </Card>

        {/* params */}
        <Card>
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Parameters</h2>
          <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {PARAM_DEFS.map((d) => (
              <div key={d.key}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-slate-200">{d.label}</span>
                  <span className="text-sm font-semibold text-brand-light">{Math.round(p[d.key] * 100)}%</span>
                </div>
                <input type="range" min={0} max={1} step={0.05} value={p[d.key]} onChange={(e) => setP({ ...p, [d.key]: Number(e.target.value) })} className="mt-2 w-full accent-brand" />
              </div>
            ))}
          </div>
        </Card>

        {/* sell / cash out */}
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Sell agent</h2>
          <p className="mt-1 text-xs text-slate-500">List your agent on the marketplace. When someone buys it, the sale price is paid into your cash balance.</p>
          <label className="mt-3 flex items-center gap-3">
            <input type="checkbox" checked={forSale} onChange={(e) => setForSale(e.target.checked)} className="h-4 w-4 accent-brand" />
            <span className="text-sm">List this agent for sale</span>
          </label>
          {forSale && (
            <div className="mt-3">
              <label className="mb-1 block text-xs text-slate-400">Sale price (USD)</label>
              <input type="number" min={0} className="input w-40" value={priceUsd} onChange={(e) => setPriceUsd(Number(e.target.value))} />
            </div>
          )}
        </Card>

        {err && <p className="text-sm text-down">{err}</p>}
        {msg && <p className="text-sm text-up">{msg}</p>}
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" disabled={busy || nameStatus === "taken"} onClick={save}>Save changes</button>
          <button className="btn-ghost" disabled={busy} onClick={() => nav(`/agents/${id}`)}>Cancel</button>
          <button className="btn-ghost ml-auto !text-down hover:!border-down/50" disabled={busy} onClick={remove}>Delete agent</button>
        </div>
      </div>
    </div>
  );
}
