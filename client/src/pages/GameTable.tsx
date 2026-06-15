import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type GameDetail } from "../lib/api";
import { getSocket } from "../lib/socket";
import { AgentAvatar, Badge, Card, PlayingCard, Spinner } from "../components/ui";

interface SeatView {
  seatIndex: number;
  agentName: string;
  stack: number;
  committed: number;
  hole: string[];
  folded: boolean;
  allIn: boolean;
  isWinner?: boolean;
}
interface TableState {
  handNumber: number;
  street: string;
  board: string[];
  pot: number;
  toAct: number;
  dealer: number;
  seats: SeatView[];
  log: string[];
}
interface FeedItem {
  seatIndex: number;
  agentName: string;
  action: string;
  amount: number;
  reasoning?: string;
  engine?: string;
}

function seatPos(i: number, n: number) {
  // distribute around an ellipse; seat 0 at bottom-center
  const angle = Math.PI / 2 + (i / n) * 2 * Math.PI;
  const x = 50 + 44 * Math.cos(angle);
  const y = 50 + 42 * Math.sin(angle);
  return { left: `${x}%`, top: `${y}%` };
}

const actionColor = (a: string) =>
  a === "fold" ? "red" : ["raise", "bet", "allin"].includes(a) ? "pink" : "ink";

export default function GameTable() {
  const { id } = useParams();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [table, setTable] = useState<TableState | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<string>("");
  const [summary, setSummary] = useState<any[] | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.game(id!).then((g) => {
      setGame(g);
      setStatus(g.status);
      if (g.live) setTable(g.live);
      if (g.status === "finished") {
        // build a static feed from recorded decisions
        setFeed(g.decisions.map((d) => ({
          seatIndex: 0, agentName: d.agent?.name ?? "Agent", action: d.action,
          amount: d.amount, reasoning: d.reasoning, engine: d.engine,
        })));
      }
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    socket.emit("game:watch", id);

    const onSnapshot = (p: any) => setTable(p.state);
    const onHandStart = (p: any) => { setTable(p.state); setSummary(null); setStatus("running"); };
    const onStreet = (p: any) => setTable(p.state);
    const onAction = (p: any) => {
      setTable(p.state);
      setFeed((f) => [{ seatIndex: p.seatIndex, agentName: p.agentName, action: p.action, amount: p.amount, reasoning: p.reasoning, engine: p.engine }, ...f].slice(0, 60));
    };
    const onShowdown = (p: any) => setTable(p.state);
    const onFinished = (p: any) => { setStatus("finished"); setSummary(p.summary); };

    socket.on("game:snapshot", onSnapshot);
    socket.on("game:hand_start", onHandStart);
    socket.on("game:street", onStreet);
    socket.on("game:action", onAction);
    socket.on("game:showdown", onShowdown);
    socket.on("game:finished", onFinished);

    return () => {
      socket.emit("game:leave", id);
      socket.off("game:snapshot", onSnapshot);
      socket.off("game:hand_start", onHandStart);
      socket.off("game:street", onStreet);
      socket.off("game:action", onAction);
      socket.off("game:showdown", onShowdown);
      socket.off("game:finished", onFinished);
    };
  }, [id]);

  if (!game) return <Spinner />;

  const seats: SeatView[] = table?.seats ?? (game.seats ?? []).map((s: any, i: number) => ({
    seatIndex: i, agentName: s.agent?.name ?? "Agent", stack: Number(s.stack), committed: 0,
    hole: [], folded: false, allIn: false,
  }));
  const n = Math.max(seats.length, 2);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <Link to="/live" className="text-xs text-slate-500 hover:text-slate-300">← Games</Link>
            <h1 className="text-xl font-extrabold">{game.name}</h1>
          </div>
          {status === "running" ? <Badge color="pink">● LIVE · hand {table?.handNumber ?? game.handNumber}</Badge>
            : status === "finished" ? <Badge color="green">Finished</Badge> : <Badge color="ink">Waiting…</Badge>}
        </div>

        {/* The table */}
        <div className="card relative mx-auto aspect-[16/11] w-full overflow-hidden p-6">
          {/* felt */}
          <div className="absolute inset-8 rounded-[45%] border-4 border-ink-700 bg-gradient-to-br from-ink-800 to-ink-900 shadow-inner" />
          {/* center: board + pot */}
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
            <div className="flex gap-1.5">
              {(table?.board ?? []).map((c, i) => <PlayingCard key={i} card={c} small />)}
              {Array.from({ length: Math.max(0, 5 - (table?.board?.length ?? 0)) }).map((_, i) => (
                <div key={`e${i}`} className="h-10 w-7 rounded-md border border-dashed border-ink-600" />
              ))}
            </div>
            <div className="rounded-full bg-ink-950/70 px-4 py-1 text-sm font-bold text-pai-cyan">
              Pot {table?.pot ?? 0}
            </div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500">{table?.street ?? "—"}</div>
          </div>

          {/* seats */}
          {seats.map((s) => {
            const pos = seatPos(s.seatIndex, n);
            const active = table?.toAct === s.seatIndex;
            return (
              <div key={s.seatIndex} className="absolute -translate-x-1/2 -translate-y-1/2" style={pos}>
                <div className={`w-28 rounded-xl border p-2 text-center transition ${
                  s.isWinner ? "border-up bg-up/10 shadow-glow"
                  : active ? "border-pai-pink bg-ink-800 shadow-glow"
                  : s.folded ? "border-ink-700 bg-ink-900/60 opacity-50" : "border-ink-700 bg-ink-850"}`}>
                  <div className="flex items-center justify-center gap-1">
                    <AgentAvatar avatar={undefined} name={s.agentName} size={22} />
                    <span className="truncate text-xs font-semibold">{s.agentName}</span>
                  </div>
                  <div className="mt-1 flex justify-center gap-0.5">
                    {(s.hole.length ? s.hole : ["??", "??"]).map((c, i) => (
                      <PlayingCard key={i} card={c} hidden={c === "??"} small />
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-slate-200">{s.stack} chips</div>
                  {s.committed > 0 && <div className="text-[10px] text-pai-cyan">bet {s.committed}</div>}
                  {s.allIn && <Badge color="pink">ALL-IN</Badge>}
                  {s.isWinner && <Badge color="green">WINNER</Badge>}
                </div>
              </div>
            );
          })}
        </div>

        {summary && (
          <Card className="mt-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Final results</h2>
            <div className="mt-3 space-y-1">
              {[...summary].sort((a, b) => b.finalStack - a.finalStack).map((s, i) => (
                <div key={s.agentId} className="flex items-center justify-between text-sm">
                  <span>{i === 0 ? "🏆 " : `${i + 1}. `}{s.agentName}</span>
                  <span className={s.netChips >= 0 ? "text-up" : "text-down"}>
                    {s.finalStack} chips ({s.netChips >= 0 ? "+" : ""}{s.netChips})
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Decision feed */}
      <div>
        <Card className="lg:sticky lg:top-20">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Live AI decisions</h2>
          <p className="mt-1 text-[11px] text-slate-500">Every action and its reasoning — fully transparent.</p>
          <div ref={feedRef} className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {feed.length ? feed.map((f, i) => (
              <div key={i} className="rounded-lg border border-ink-800 bg-ink-850/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{f.agentName}</span>
                  <Badge color={actionColor(f.action) as any}>{f.action}{f.amount ? ` ${f.amount}` : ""}</Badge>
                </div>
                {f.reasoning && <p className="mt-1 text-xs text-slate-400">{f.reasoning}</p>}
                <div className="mt-1 text-[10px] text-slate-600">{f.engine === "claude" ? "🧠 Claude" : "⚙️ simulated"}</div>
              </div>
            )) : <p className="text-sm text-slate-500">Waiting for the action to begin…</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
