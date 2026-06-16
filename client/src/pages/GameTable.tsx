import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type GameDetail } from "../lib/api";
import { getSocket } from "../lib/socket";
import { AgentAvatar, Badge, Card, PlayingCard, Spinner } from "../components/ui";
import { Volume, VolumeOff } from "../components/icons";
import { play, isMuted, setMuted } from "../lib/sound";
import { useAuth } from "../context/AuthContext";

function Confetti() {
  const colors = ["#3a6ad0", "#22d3ee", "#26d07c", "#e0c64a", "#ffffff"];
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    left: (i * 1.7 + (i % 5) * 3) % 100,
    delay: (i % 10) * 0.08,
    dur: 1.6 + (i % 5) * 0.25,
    color: colors[i % colors.length],
  }));
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
    </div>
  );
}

interface LastAction { type: string; amount: number }
interface SeatView {
  seatIndex: number;
  agentName: string;
  stack: number;
  committed: number;
  hole: string[];
  folded: boolean;
  allIn: boolean;
  lastAction?: LastAction;
  isWinner?: boolean;
}
interface TableState {
  handNumber: number;
  street: string;
  board: string[];
  pot: number;
  toAct: number;
  dealerSeat: number;
  sbSeat: number;
  bbSeat: number;
  seats: SeatView[];
  log: string[];
}
interface FeedItem { agentName: string; action: string; amount: number; reasoning?: string; engine?: string }
interface Winner { seatIndex: number; amount: number; hand: string }

function seatPos(i: number, n: number) {
  const angle = Math.PI / 2 + (i / n) * 2 * Math.PI;
  // radii kept modest so seat cards sit inside the felt and never clip
  return { left: `${50 + 38 * Math.cos(angle)}%`, top: `${50 + 33 * Math.sin(angle)}%` };
}

const ACTION_STYLE: Record<string, string> = {
  fold: "bg-down/15 text-down",
  check: "bg-ink-700 text-slate-300",
  call: "bg-pai-cyan/15 text-pai-cyan",
  bet: "bg-brand/20 text-brand-light",
  raise: "bg-brand/20 text-brand-light",
  allin: "bg-amber-400/15 text-amber-300",
};
const STREETS = ["preflop", "flop", "turn", "river"];

export default function GameTable() {
  const { id } = useParams();
  const { user } = useAuth();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [feedFilter, setFeedFilter] = useState<"all" | "mine">("all");
  const [table, setTable] = useState<TableState | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<string>("");
  const [winners, setWinners] = useState<Winner[]>([]);
  const [summary, setSummary] = useState<any[] | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [callout, setCallout] = useState<{ text: string; tone: string; key: number } | null>(null);
  const [allinFlash, setAllinFlash] = useState(0);
  const [displayPot, setDisplayPot] = useState(0);

  useEffect(() => {
    api.game(id!).then((g) => {
      setGame(g);
      setStatus(g.status);
      if (g.live) setTable(g.live);
      if (g.status === "finished") {
        setFeed(g.decisions.slice(-60).reverse().map((d) => ({
          agentName: d.agent?.name ?? "Agent", action: d.action, amount: d.amount, reasoning: d.reasoning, engine: d.engine,
        })));
      }
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    socket.emit("game:watch", id);
    const onSnapshot = (p: any) => setTable(p.state);
    const onHandStart = (p: any) => { setTable(p.state); setWinners([]); setSummary(null); setStatus("running"); play("deal"); };
    const onStreet = (p: any) => { setTable(p.state); play("deal"); };
    const onAction = (p: any) => {
      setTable(p.state);
      setFeed((f) => [{ agentName: p.agentName, action: p.action, amount: p.amount, reasoning: p.reasoning, engine: p.engine }, ...f].slice(0, 60));
      play(p.action as any);
      setCallout({ text: `${p.action}${p.amount ? " " + p.amount : ""}`, tone: p.action, key: Date.now() });
      if (p.action === "allin") setAllinFlash(Date.now());
    };
    const onShowdown = (p: any) => { setTable(p.state); setWinners(p.result?.winners ?? []); play("win"); };
    const onFinished = (p: any) => { setStatus("finished"); setSummary(p.summary); };
    socket.on("game:snapshot", onSnapshot);
    socket.on("game:hand_start", onHandStart);
    socket.on("game:street", onStreet);
    socket.on("game:action", onAction);
    socket.on("game:showdown", onShowdown);
    socket.on("game:finished", onFinished);
    return () => {
      socket.emit("game:leave", id);
      ["game:snapshot","game:hand_start","game:street","game:action","game:showdown","game:finished"].forEach((e) => socket.off(e));
    };
  }, [id]);

  // pot count-up animation
  useEffect(() => {
    const target = table?.pot ?? 0;
    const start = displayPot;
    if (start === target) return;
    const t0 = performance.now(), diff = target - start, dur = 400;
    let raf = requestAnimationFrame(function step(now) {
      const k = Math.min(1, (now - t0) / dur);
      setDisplayPot(Math.round(start + diff * k));
      if (k < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.pot]);

  if (!game) return <Spinner />;

  const seats: SeatView[] = table?.seats ?? (game.seats ?? []).map((s: any, i: number) => ({
    seatIndex: i, agentName: s.agent?.name ?? "Agent", stack: Number(s.stack), committed: 0, hole: [], folded: false, allIn: false,
  }));
  const n = Math.max(seats.length, 2);
  const winnerOf = (si: number) => winners.find((w) => w.seatIndex === si);
  const streetIdx = STREETS.indexOf(table?.street ?? "preflop");
  const myAgentNames = new Set((game.seats ?? []).filter((s: any) => s.userId && s.userId === user?.id).map((s: any) => s.agent?.name));
  const hasMine = myAgentNames.size > 0;
  const visibleFeed = feedFilter === "mine" ? feed.filter((f) => myAgentNames.has(f.agentName)) : feed;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <Link to="/live" className="text-xs text-slate-500 hover:text-slate-300">← Games</Link>
            <h1 className="flex items-center gap-2 text-xl font-extrabold">{game.name} {game.practice && <Badge color="cyan">Practice · no real P&L</Badge>}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { const m = !muted; setMuted(m); setMutedState(m); if (!m) play("click"); }}
              title={muted ? "Unmute" : "Mute"} className="text-slate-400 transition hover:text-slate-100">
              {muted ? <VolumeOff size={18} /> : <Volume size={18} />}
            </button>
            {status === "running" ? <Badge color="pink">● LIVE · hand {table?.handNumber ?? game.handNumber}</Badge>
              : status === "finished" ? <Badge color="green">Finished</Badge> : <Badge color="ink">Waiting…</Badge>}
          </div>
        </div>

        {/* street progress */}
        <div className="mb-3 flex gap-1.5">
          {STREETS.map((s, i) => (
            <div key={s} className={`flex-1 rounded-full py-1 text-center text-[11px] font-semibold uppercase tracking-wide transition ${
              i === streetIdx ? "bg-brand text-white" : i < streetIdx ? "bg-brand/25 text-brand-light" : "bg-ink-800 text-slate-600"}`}>
              {s}
            </div>
          ))}
        </div>

        {/* table */}
        <div className="relative mx-auto aspect-[16/10] w-full select-none">
          {/* soft ground shadow under the table */}
          <div className="absolute inset-[4%] rounded-[50%] bg-black/70 blur-2xl" />
          {/* wooden rail — warm walnut with cushioned top sheen & dark underside */}
          <div className="absolute inset-[3%] rounded-[50%]" style={{ background: "#241913", boxShadow: "inset 0 7px 14px rgba(196,156,96,0.20), inset 0 -18px 30px rgba(0,0,0,0.82), 0 38px 72px -18px rgba(0,0,0,0.95)" }} />
          <div className="absolute inset-[3%] rounded-[50%] border border-[#c8a25a]/15" />
          {/* double brass trim */}
          <div className="absolute inset-[9%] rounded-[50%] border-2 border-[#c79a4e]/60 shadow-[0_0_14px_rgba(199,154,78,0.30)]" />
          <div className="absolute inset-[9.9%] rounded-[50%] border border-[#e7cf94]/25" />
          {/* casino-green felt with deep vignette */}
          <div className="absolute inset-[10.5%] rounded-[50%]" style={{ background: "#0c5a38", boxShadow: "inset 0 0 150px rgba(0,0,0,0.80), inset 0 9px 24px rgba(0,0,0,0.5)" }} />
          {/* overhead spotlight on the felt */}
          <div className="pointer-events-none absolute inset-[10.5%] rounded-[50%]" style={{ background: "radial-gradient(58% 54% at 50% 42%, rgba(255,255,255,0.11), rgba(255,255,255,0) 70%)" }} />
          {/* dealer betting line */}
          <div className="absolute inset-[20%] rounded-[50%] border border-white/[0.10]" />
          <div className="absolute inset-[20%] rounded-[50%] border-t border-[#0f7a4c]/40" />
          {/* center felt logo watermark */}
          <img src="/images/pai-logo.png" alt="" className="pointer-events-none absolute left-1/2 top-1/2 w-28 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" />

          {/* center: board + pot */}
          <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
            <div className="flex gap-1.5">
              {(table?.board ?? []).map((c, i) => (
                <div key={c + i} className="animate-deal" style={{ animationDelay: `${i * 70}ms` }}><PlayingCard card={c} small /></div>
              ))}
              {Array.from({ length: Math.max(0, 5 - (table?.board?.length ?? 0)) }).map((_, i) => (
                <div key={`e${i}`} className="h-10 w-7 rounded-md border border-dashed border-ink-600/70" />
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-ink-950/70 px-4 py-1.5 shadow-lg">
              <span className="inline-block h-3 w-3 rounded-full bg-brand ring-2 ring-brand-light/40" />
              <span className="tabular text-sm font-bold text-white">{displayPot}</span>
              <span className="text-[11px] uppercase tracking-wide text-slate-400">pot</span>
            </div>
          </div>

          {/* seats */}
          {seats.map((s, idx) => {
            const pos = seatPos(idx, n);
            const active = table?.toAct === s.seatIndex && status === "running";
            const win = winnerOf(s.seatIndex);
            const pos3 = table?.dealerSeat === s.seatIndex ? "D" : table?.sbSeat === s.seatIndex ? "SB" : table?.bbSeat === s.seatIndex ? "BB" : null;
            return (
              <div key={s.seatIndex} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={pos}>
                <div className={`relative w-28 rounded-xl border p-2 text-center shadow-lg backdrop-blur-sm transition ${
                  win ? "border-up bg-up/10 animate-win"
                  : active ? "border-brand bg-ink-800/95 animate-turn"
                  : s.folded ? "border-ink-800 bg-ink-900/60 opacity-45"
                  : "border-ink-700 bg-ink-900/85"}`}>

                  {pos3 && (
                    <span className={`absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                      pos3 === "D" ? "bg-white text-ink-950" : "bg-ink-700 text-slate-200"}`}>{pos3}</span>
                  )}

                  <div className="flex items-center justify-center gap-1.5">
                    <AgentAvatar name={s.agentName} size={24} />
                    <span className="truncate text-xs font-semibold">{s.agentName}</span>
                  </div>

                  <div className="mt-1.5 flex justify-center gap-1">
                    {(s.hole.length ? s.hole : ["??", "??"]).map((c, i) => (
                      <PlayingCard key={i} card={c} hidden={c === "??"} small />
                    ))}
                  </div>

                  <div className="mt-1.5 flex items-center justify-center gap-1 text-xs font-bold text-slate-200">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand/70" /> {s.stack}
                  </div>

                  {win ? (
                    <div className="mt-1 text-[11px] font-bold text-up animate-fade">WON +{win.amount} · {win.hand}</div>
                  ) : s.lastAction ? (
                    <div className={`mx-auto mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase animate-chip ${ACTION_STYLE[s.lastAction.type] ?? "bg-ink-700 text-slate-300"}`}>
                      {s.lastAction.type}{s.lastAction.amount ? ` ${s.lastAction.amount}` : ""}
                    </div>
                  ) : active ? (
                    <div className="mt-1 text-[11px] text-brand-light">thinking…</div>
                  ) : null}

                  {/* on-the-clock timer bar */}
                  {active && (
                    <div className="absolute -bottom-1 left-2 right-2 h-1 overflow-hidden rounded-full bg-ink-700">
                      <div className="h-full w-full rounded-full bg-brand animate-clock" />
                    </div>
                  )}

                  {/* committed chips toward the pot */}
                  {s.committed > 0 && !win && (
                    <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink-950/90 px-2 py-0.5 text-[11px] font-semibold text-pai-cyan">
                      {s.committed}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* big action callout */}
          {callout && (
            <div key={callout.key} className={`animate-pop pointer-events-none absolute left-1/2 top-[38%] z-30 -translate-x-1/2 -translate-y-1/2 rounded-xl px-4 py-1.5 text-lg font-extrabold uppercase tracking-wide shadow-xl ${ACTION_STYLE[callout.tone] ?? "bg-ink-800 text-white"}`}>
              {callout.text}
            </div>
          )}

          {/* all-in screen flash */}
          {allinFlash > 0 && <div key={allinFlash} className="animate-allin pointer-events-none absolute inset-[10%] z-20 rounded-[50%] bg-amber-400/40" />}

          {/* winner confetti */}
          {winners.length > 0 && <Confetti />}
        </div>

        {summary && (
          <Card className="mt-4 animate-fade">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Final results</h2>
            <div className="mt-3 space-y-1.5">
              {[...summary].sort((a, b) => b.finalStack - a.finalStack).map((s, i) => (
                <div key={s.agentId} className="flex items-center justify-between rounded-lg bg-ink-850/50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-up/20 text-up" : "bg-ink-700 text-slate-400"}`}>{i + 1}</span>
                    <AgentAvatar name={s.agentName} size={22} /> {s.agentName}
                  </span>
                  <span className={s.netChips >= 0 ? "text-up" : "text-down"}>
                    {s.finalStack} chips ({s.netChips >= 0 ? "+" : ""}{s.netChips})
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* decision feed */}
      <div>
        <Card className="lg:sticky lg:top-20">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Live AI decisions</h2>
            {hasMine && (
              <div className="flex gap-1 rounded-lg bg-ink-850 p-0.5 text-xs">
                <button onClick={() => setFeedFilter("all")} className={`rounded-md px-2.5 py-1 font-medium ${feedFilter === "all" ? "bg-ink-700 text-white" : "text-slate-400"}`}>All</button>
                <button onClick={() => setFeedFilter("mine")} className={`rounded-md px-2.5 py-1 font-medium ${feedFilter === "mine" ? "bg-ink-700 text-white" : "text-slate-400"}`}>My agent</button>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">{feedFilter === "mine" ? "Your agent's reasoning for every decision." : "Every action and its reasoning — fully transparent."}</p>
          <div className="mt-3 max-h-[64vh] space-y-2 overflow-y-auto pr-1">
            {visibleFeed.length ? visibleFeed.map((f, i) => (
              <div key={i} className={`rounded-lg border border-ink-800 bg-ink-850/40 p-3 text-sm ${i === 0 ? "animate-fade" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold text-slate-200">
                    <AgentAvatar name={f.agentName} size={20} /> {f.agentName}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${ACTION_STYLE[f.action] ?? "bg-ink-700 text-slate-300"}`}>
                    {f.action}{f.amount ? ` ${f.amount}` : ""}
                  </span>
                </div>
                {f.reasoning && <p className="mt-1 text-xs text-slate-400">{f.reasoning}</p>}
                <div className="mt-1 text-[11px] text-slate-600">{f.engine === "claude" ? "Claude" : "Simulated"}</div>
              </div>
            )) : <p className="text-sm text-slate-500">{feedFilter === "mine" ? "No decisions from your agent yet." : "Waiting for the action to begin…"}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
