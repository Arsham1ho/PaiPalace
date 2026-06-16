import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui";
import { UserIcon, Wallet as WalletIcon, Settings as Gear, Copy } from "../components/icons";
import { shortAddr } from "../lib/format";

const userAvatar = (seed: string) => `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}`;

const TABS = [
  { key: "profile", label: "Profile", icon: UserIcon },
  { key: "account", label: "Account", icon: Gear },
  { key: "wallet", label: "Wallet", icon: WalletIcon },
] as const;

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink-800 py-4 last:border-0">
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("profile");
  const [username, setUsername] = useState(user?.username ?? "");
  const [editingName, setEditingName] = useState(false);
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [conf, setConf] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const flash = (m: string, isErr = false) => { isErr ? setErr(m) : setMsg(m); setTimeout(() => { setMsg(""); setErr(""); }, 3000); };

  const saveName = async () => {
    setBusy(true); setErr(""); setMsg("");
    try { await api.updateUsername(username.trim()); await refresh(); setEditingName(false); flash("Username updated."); }
    catch (e: any) { flash(e.message, true); } finally { setBusy(false); }
  };
  const savePassword = async () => {
    if (nw !== conf) return flash("New passwords do not match.", true);
    setBusy(true); setErr(""); setMsg("");
    try { await api.changePassword(cur, nw); setCur(""); setNw(""); setConf(""); flash("Password changed."); }
    catch (e: any) { flash(e.message, true); } finally { setBusy(false); }
  };
  const copyAddr = async () => {
    if (!user.walletAddress) return;
    await navigator.clipboard.writeText(user.walletAddress);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      {/* sidebar */}
      <aside className="space-y-1">
        <h1 className="mb-2 px-3 text-lg font-extrabold tracking-tight">Settings</h1>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${tab === t.key ? "bg-ink-800 text-white" : "text-slate-400 hover:bg-ink-850 hover:text-slate-200"}`}>
            <t.icon size={18} /> {t.label}
          </button>
        ))}
      </aside>

      {/* content */}
      <div>
        {msg && <div className="mb-4 rounded-lg border border-up/30 bg-up/10 px-4 py-2 text-sm text-up">{msg}</div>}
        {err && <div className="mb-4 rounded-lg border border-down/30 bg-down/10 px-4 py-2 text-sm text-down">{err}</div>}

        {tab === "profile" && (
          <Card>
            <h2 className="text-lg font-bold">Profile</h2>
            <Row label="Profile picture" hint="Generated from your username">
              <img src={userAvatar(user.username)} alt="" className="h-12 w-12 rounded-full border border-ink-700 bg-ink-800" />
            </Row>
            <Row label="Username">
              {editingName ? (
                <>
                  <input className="input !w-56" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={24} />
                  <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={busy} onClick={saveName}>Save</button>
                  <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { setUsername(user.username); setEditingName(false); }}>Cancel</button>
                </>
              ) : (
                <>
                  <span className="text-sm text-slate-300">{user.username}</span>
                  <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setEditingName(true)}>Edit</button>
                </>
              )}
            </Row>
            <Row label="Email" hint="Used to sign in"><span className="text-sm text-slate-400">{user.email}</span></Row>
            <Row label="Role"><span className="text-sm text-slate-400">{user.isAdmin ? "Admin" : "Member"}</span></Row>
          </Card>
        )}

        {tab === "account" && (
          <Card>
            <h2 className="text-lg font-bold">Account</h2>
            <p className="mt-1 text-sm text-slate-400">Change your password.</p>
            <div className="mt-4 max-w-sm space-y-3">
              <input type="password" className="input" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} />
              <input type="password" className="input" placeholder="New password" value={nw} onChange={(e) => setNw(e.target.value)} />
              <input type="password" className="input" placeholder="Confirm new password" value={conf} onChange={(e) => setConf(e.target.value)} />
              <button className="btn-primary" disabled={busy || !cur || !nw} onClick={savePassword}>Update password</button>
            </div>
          </Card>
        )}

        {tab === "wallet" && (
          <Card>
            <h2 className="text-lg font-bold">Wallet</h2>
            <Row label="Connected wallet" hint={user.walletAddress ? "Solana address" : "Not connected"}>
              {user.walletAddress ? (
                <>
                  <span className="font-mono text-sm text-slate-300">{shortAddr(user.walletAddress)}</span>
                  <button className="btn-ghost !px-2 !py-1.5 text-xs" onClick={copyAddr}><Copy size={14} /> {copied ? "Copied" : "Copy"}</button>
                </>
              ) : (
                <a href="/wallet" className="btn-primary !px-3 !py-1.5 text-xs">Connect</a>
              )}
            </Row>
            <Row label="Balance"><span className="text-sm font-semibold text-up">${(user.balance / 1e6).toFixed(2)}</span></Row>
          </Card>
        )}
      </div>
    </div>
  );
}
