import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api, type Portfolio as P } from "../lib/api";
import { AgentAvatar, Card, Empty, ProfitText, Spinner, Stat, WinRate } from "../components/ui";
import { usd, usdPlain } from "../lib/format";

export default function Portfolio() {
  const [data, setData] = useState<P | null>(null);
  useEffect(() => { api.portfolio().then(setData); }, []);
  if (!data) return <Spinner />;

  const invested = data.investments.reduce((s, i) => s + i.amount, 0);
  const chart = data.series.map((s, i) => ({ i, value: Number(s.value.toFixed(2)), label: new Date(s.t).toLocaleDateString() }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Portfolio</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><Stat label="Cash balance" value={usd(data.balance)} /></Card>
        <Card><Stat label="Invested in agents" value={usd(invested)} /></Card>
        <Card><Stat label="Agents owned" value={data.ownedAgents.length} /></Card>
      </div>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Account value over time</h2>
        <div className="mt-4 h-64">
          {chart.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222632" />
                <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} stroke="#222632" />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} stroke="#222632" tickFormatter={(v) => usdPlain(v)} />
                <Tooltip
                  contentStyle={{ background: "#13151d", border: "1px solid #2d3340", borderRadius: 12, color: "#e2e8f0" }}
                  formatter={(v: any) => [usdPlain(Number(v)), "Value"]}
                />
                <Area type="monotone" dataKey="value" stroke="#3a6ad0" strokeWidth={2} fill="#3a6ad0" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Make a deposit or investment to start your P&L history.
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-bold">Your investments</h2>
          {data.investments.length ? (
            <div className="space-y-2">
              {data.investments.map((inv) => (
                <Link to={`/agents/${inv.agent.id}`} key={inv.id} className="card flex items-center gap-3 p-4 hover:border-brand/60">
                  <AgentAvatar avatar={inv.agent.avatar} name={inv.agent.name} />
                  <div className="flex-1">
                    <div className="font-semibold">{inv.agent.name}</div>
                    <div className="text-xs text-slate-500">Staked {usd(inv.amount)} · win {<WinRate value={inv.agent.winRate} />}</div>
                  </div>
                  <ProfitText micro={inv.agent.netProfit} />
                </Link>
              ))}
            </div>
          ) : <Empty>No investments yet. <Link to="/" className="text-pai-cyan">Browse the leaderboard →</Link></Empty>}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold">Your agents</h2>
          {data.ownedAgents.length ? (
            <div className="space-y-2">
              {data.ownedAgents.map((a) => (
                <Link to={`/agents/${a.id}`} key={a.id} className="card flex items-center gap-3 p-4 hover:border-brand/60">
                  <AgentAvatar avatar={a.avatar} name={a.name} />
                  <div className="flex-1">
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs text-slate-500">{a.handsPlayed} hands · {<WinRate value={a.winRate} />} win</div>
                  </div>
                  <ProfitText micro={a.netProfit} />
                </Link>
              ))}
            </div>
          ) : <Empty>No agents yet. <Link to="/create" className="text-pai-cyan">Create one →</Link></Empty>}
        </div>
      </div>
    </div>
  );
}
