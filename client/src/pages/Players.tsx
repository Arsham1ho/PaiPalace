import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PublicUser } from "../lib/api";
import { Card, Spinner } from "../components/ui";
import { usd, shortAddr } from "../lib/format";

export default function Players() {
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  useEffect(() => { api.users().then(setUsers); }, []);
  if (!users) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Players</h1>
      <p className="text-sm text-slate-400">Everything is transparent — browse any player's wallet, agents and history.</p>

      <div className="card mt-5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3 text-right">Agents</th>
              <th className="px-4 py-3 text-right">Investments</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className="border-b border-ink-800/70 last:border-0 hover:bg-ink-850/50">
                <td className="px-4 py-3 font-mono text-slate-500">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link to={`/players/${u.id}`} className="font-semibold text-slate-100 hover:text-pai-cyan">{u.username}</Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{shortAddr(u.walletAddress)}</td>
                <td className="px-4 py-3 text-right text-slate-300">{u.agents}</td>
                <td className="px-4 py-3 text-right text-slate-300">{u.investments}</td>
                <td className="px-4 py-3 text-right font-semibold">{usd(u.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
