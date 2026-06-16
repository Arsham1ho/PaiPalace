import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AdminStats, type AdminUser } from "../lib/api";
import { Card, Badge, Spinner, Stat } from "../components/ui";
import { usd, shortAddr, timeAgo } from "../lib/format";

export default function Admin() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [s, u] = await Promise.all([api.adminStats(), api.adminUsers()]);
    setStats(s); setUsers(u);
  };
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  const act = async (fn: () => Promise<any>, ok: string) => {
    setMsg("");
    try { await fn(); await load(); setMsg(ok); } catch (e: any) { setMsg(e.message); }
  };

  const setBalance = (u: AdminUser) => {
    const input = window.prompt(`Set balance for ${u.username} (USD):`, String(u.balance / 1e6));
    if (input == null) return;
    const v = Number(input);
    if (!(v >= 0)) return;
    act(() => api.adminSetBalance(u.id, v), `Set ${u.username}'s balance to ${usd(v * 1e6)}.`);
  };

  if (!stats || !users) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Admin Panel</h1>
        <p className="text-sm text-slate-400">Owner-only. Manage every user and view platform totals.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card><Stat label="Users" value={stats.users} /></Card>
        <Card><Stat label="Agents" value={stats.agents} /></Card>
        <Card><Stat label="Games" value={stats.games} /></Card>
        <Card><Stat label="Decisions" value={stats.decisions.toLocaleString()} /></Card>
        <Card><Stat label="Total balance" value={usd(stats.totalBalance)} /></Card>
        <Card><Stat label="Deposits" value={usd(stats.totalDeposits)} /></Card>
      </div>

      {msg && <p className="text-sm text-brand-light">{msg}</p>}

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-center">Role</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Controls</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-ink-800/70 last:border-0 hover:bg-ink-850/50">
                <td className="px-4 py-3">
                  <Link to={`/players/${u.id}`} className="font-semibold text-slate-100 hover:text-brand-light">{u.username}</Link>
                  <div className="text-xs text-slate-500">{u.email}</div>
                  <div className="text-xs text-slate-600">{u.agents} agents · {u.investments} inv · {u.transactions} tx</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{shortAddr(u.walletAddress) || "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">{usd(u.balance)}</td>
                <td className="px-4 py-3 text-center">
                  {u.isAdmin && <Badge color="cyan">admin</Badge>}
                  {u.banned && <Badge color="red">banned</Badge>}
                  {!u.isAdmin && !u.banned && <span className="text-xs text-slate-500">user</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{timeAgo(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setBalance(u)}>Balance</button>
                    <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => act(() => api.adminBan(u.id, !u.banned), u.banned ? "Unbanned." : "Banned.")}>
                      {u.banned ? "Unban" : "Ban"}
                    </button>
                    <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => act(() => api.adminToggleAdmin(u.id, !u.isAdmin), "Role updated.")}>
                      {u.isAdmin ? "Revoke admin" : "Make admin"}
                    </button>
                    <button className="btn-ghost !px-2 !py-1 text-xs !text-down" onClick={() => {
                      if (window.confirm(`Delete ${u.username}? This cannot be undone.`)) act(() => api.adminDeleteUser(u.id), "User deleted.");
                    }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
