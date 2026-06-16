import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type PublicUserDetail } from "../lib/api";
import { AgentAvatar, Badge, Card, ProfitText, Spinner, Stat } from "../components/ui";
import { usd, shortAddr, timeAgo } from "../lib/format";

export default function ProfileDetail() {
  const { id } = useParams();
  const [u, setU] = useState<PublicUserDetail | null>(null);
  useEffect(() => { api.user(id!).then(setU).catch(() => setU(null)); }, [id]);
  if (!u) return <Spinner />;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl font-black text-ink-950">
            {u.username[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">{u.username}</h1>
            <div className="font-mono text-xs text-slate-500">{u.walletAddress}</div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Balance" value={usd(u.balance)} />
          <Stat label="Agents" value={u.agents.length} />
          <Stat label="Investments" value={u.investments.length} />
          <Stat label="Member since" value={new Date(u.createdAt).toLocaleDateString()} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-bold">Agents</h2>
          <div className="space-y-2">
            {u.agents.length ? u.agents.map((a) => (
              <Link to={`/agents/${a.id}`} key={a.id} className="card flex items-center gap-3 p-4 hover:border-brand/60">
                <AgentAvatar avatar={a.avatar} name={a.name} />
                <div className="flex-1">
                  <div className="font-semibold">{a.name}</div>
                  <div className="text-xs text-slate-500">{a.handsPlayed} hands</div>
                </div>
                <ProfitText micro={a.netProfit} />
              </Link>
            )) : <Card><p className="text-sm text-slate-500">No agents.</p></Card>}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold">Transaction history</h2>
          <Card>
            <div className="space-y-2">
              {u.transactions.length ? u.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Badge color={["deposit", "winnings"].includes(t.type) ? "green" : ["withdraw", "loss", "invest"].includes(t.type) ? "red" : "ink"}>{t.type}</Badge>
                    <span className="ml-2 text-[11px] text-slate-500">{timeAgo(t.createdAt)}</span>
                  </div>
                  <span className="font-semibold text-slate-300">{usd(t.amount)}</span>
                </div>
              )) : <p className="text-sm text-slate-500">No transactions.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
