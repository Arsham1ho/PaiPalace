import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { api, type PublicUserDetail } from "../lib/api";
import { AgentAvatar, Badge, Card, Empty, ProfitText, Spinner, Stat } from "../components/ui";
import { Copy } from "../components/icons";
import { usd, usdPlain, shortAddr, timeAgo } from "../lib/format";

const userAvatar = (seed: string) => `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}`;

const TX_TONE: Record<string, "green" | "red" | "ink" | "pink" | "cyan"> = {
  deposit: "green", winnings: "green", withdraw: "red", loss: "red",
  invest: "pink", divest: "cyan", buy_agent: "ink", admin_adjust: "cyan",
};
const isPlus = (t: string) => ["deposit", "winnings"].includes(t);
const isMinus = (t: string) => ["withdraw", "loss", "invest", "buy_agent"].includes(t);

export default function ProfileDetail() {
  const { id } = useParams();
  const [u, setU] = useState<PublicUserDetail | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { api.user(id!).then(setU).catch(() => setU(null)); }, [id]);
  if (!u) return <Spinner />;

  const chart = (u.series ?? []).map((s, i) => ({ i, value: Number(s.value.toFixed(2)) }));
  const s = u.summary;
  const copyAddr = async () => { if (u.walletAddress) { await navigator.clipboard.writeText(u.walletAddress); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  return (
    <div className="space-y-6">
      {/* header */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <img src={userAvatar(u.username)} alt="" className="h-16 w-16 rounded-2xl border border-ink-700 bg-ink-800" />
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight">{u.username}</h1>
            {u.walletAddress ? (
              <button onClick={copyAddr} className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-slate-500 hover:text-slate-300">
                {shortAddr(u.walletAddress)} {copied ? <span className="text-up">copied</span> : <Copy size={12} />}
              </button>
            ) : <div className="mt-0.5 text-xs text-slate-500">No wallet connected</div>}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Net P&L" value={<ProfitText micro={s.profit} />} />
          <Stat label="Volume" value={usd(s.volume)} />
          <Stat label="Balance" value={usd(u.balance)} />
          <Stat label="Agents" value={u.agents.length} />
          <Stat label="Member since" value={new Date(u.createdAt).toLocaleDateString()} />
        </div>
      </Card>

      {/* P&L chart */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Account value over time</h2>
          <span className="text-xs text-slate-500">{s.wins}W / {s.losses}L · {usd(s.deposited)} deposited</span>
        </div>
        <div className="mt-4 h-56">
          {chart.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222632" />
                <XAxis dataKey="i" tick={{ fill: "#64748b", fontSize: 11 }} stroke="#222632" />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} stroke="#222632" tickFormatter={(v) => usdPlain(v)} />
                <Tooltip contentStyle={{ background: "#13151d", border: "1px solid #2d3340", borderRadius: 12, color: "#e2e8f0" }}
                  formatter={(v: any) => [usdPlain(Number(v)), "Value"]} labelFormatter={() => ""} />
                <ReferenceLine y={0} stroke="#3a4150" />
                <Area type="monotone" dataKey="value" stroke="#3a6ad0" strokeWidth={2} fill="#3a6ad0" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">No activity yet.</div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* agents + investments */}
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-lg font-bold">Agents</h2>
            <div className="space-y-2">
              {u.agents.length ? u.agents.map((a) => (
                <Link to={`/agents/${a.id}`} key={a.id} className="card flex items-center gap-3 p-4 hover:border-brand/60">
                  <AgentAvatar name={a.name} />
                  <div className="flex-1">
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs text-slate-500">{a.handsPlayed} hands · ELO {a.elo}</div>
                  </div>
                  <ProfitText micro={a.netProfit} />
                </Link>
              )) : <Empty>No agents.</Empty>}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold">Investments</h2>
            <div className="space-y-2">
              {u.investments.length ? u.investments.map((inv) => (
                <Link to={`/agents/${inv.agent.id}`} key={inv.id} className="card flex items-center gap-3 p-4 hover:border-brand/60">
                  <AgentAvatar name={inv.agent.name} />
                  <div className="flex-1">
                    <div className="font-semibold">{inv.agent.name}</div>
                    <div className="text-xs text-slate-500">Staked {usd(inv.amount)}</div>
                  </div>
                  <ProfitText micro={inv.agent.netProfit} />
                </Link>
              )) : <Empty>No investments.</Empty>}
            </div>
          </div>
        </div>

        {/* transactions */}
        <div>
          <h2 className="mb-3 text-lg font-bold">Transaction history</h2>
          <Card>
            <div className="space-y-1">
              {u.transactions.length ? u.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-ink-800/60 py-2.5 text-sm last:border-0">
                  <div>
                    <Badge color={TX_TONE[t.type] ?? "ink"}>{t.type.replace("_", " ")}</Badge>
                    <span className="ml-2 text-xs text-slate-500">{timeAgo(t.createdAt)}</span>
                  </div>
                  <span className={`tabular font-semibold ${isPlus(t.type) ? "text-up" : isMinus(t.type) ? "text-down" : "text-slate-300"}`}>
                    {isPlus(t.type) ? "+" : isMinus(t.type) ? "-" : ""}{usd(t.amount)}
                  </span>
                </div>
              )) : <p className="text-sm text-slate-500">No transactions.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
