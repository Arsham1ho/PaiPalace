import { NavLink, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { usd, shortAddr } from "../lib/format";
import { ChevronDown, Settings, UserIcon, LogOut, Chart, Wallet, Trophy, Cpu, Shield } from "./icons";
import DepositModal from "./DepositModal";

const userAvatar = (seed: string) => `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}`;

const NAV = [
  { to: "/", label: "Leaderboard", end: true },
  { to: "/live", label: "Live & Past Games" },
  { to: "/create", label: "Create Agent" },
  { to: "/players", label: "Players" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setPortfolioValue(null); return; }
    api.portfolio()
      .then((p) => setPortfolioValue(p.balance + p.investments.reduce((s, i) => s + i.amount, 0)))
      .catch(() => setPortfolioValue(user.balance));
  }, [user]);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-ink-700/70 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/images/pai-logo.png" alt="PaiPalace" className="h-9 w-9 rounded-full" />
            <span className="text-xl font-bold tracking-tight">
              Pai<span className="brand-accent">Palace</span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `text-[15px] font-medium tracking-tight transition ${
                    isActive ? "text-white" : "text-slate-400 hover:text-white"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            {user?.isAdmin && (
              <NavLink to="/admin" className={({ isActive }) =>
                `text-[15px] font-medium tracking-tight transition ${isActive ? "text-brand-light" : "text-brand-light/80 hover:text-brand-light"}`}>
                Admin
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden items-center gap-5 sm:flex">
                  <Link to="/portfolio" className="text-center leading-tight">
                    <div className="text-xs text-slate-400">Portfolio</div>
                    <div className="tabular text-sm font-bold text-up">{usd(portfolioValue ?? user.balance)}</div>
                  </Link>
                  <Link to="/wallet" className="text-center leading-tight">
                    <div className="text-xs text-slate-400">Cash</div>
                    <div className="tabular text-sm font-bold text-up">{usd(user.balance)}</div>
                  </Link>
                </div>
                <button onClick={() => setDepositOpen(true)} className="btn-primary !px-4 !py-2 text-sm">Deposit</button>

                <div className="hidden h-6 w-px bg-ink-700 sm:block" />

                <div className="relative">
                  <button
                    onClick={() => setProfileOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-full transition hover:opacity-90"
                    aria-label="Account menu"
                  >
                    <img src={userAvatar(user.username)} alt={user.username} className="h-9 w-9 rounded-full border border-ink-700 bg-ink-800" />
                    <ChevronDown size={16} className="text-slate-400" />
                  </button>
                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-2xl">
                        {/* header: avatar + address + settings gear */}
                        <div className="flex items-center gap-3 border-b border-ink-700 px-2.5 pb-3 pt-2">
                          <img src={userAvatar(user.username)} alt="" className="h-10 w-10 rounded-full border border-ink-700 bg-ink-800" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-100">{user.username}</div>
                            <div className="truncate font-mono text-xs text-slate-500">{user.walletAddress ? shortAddr(user.walletAddress) : user.email}</div>
                          </div>
                          <button onClick={() => { setProfileOpen(false); nav("/settings"); }} title="Settings" className="text-slate-400 transition hover:text-slate-100">
                            <Settings size={18} />
                          </button>
                        </div>

                        {/* primary links with icons */}
                        <div className="py-1.5">
                          {[
                            { to: "/", label: "Leaderboard", Icon: Trophy },
                            { to: "/portfolio", label: "Portfolio", Icon: Chart },
                            { to: "/wallet", label: "Wallet", Icon: Wallet },
                            { to: `/players/${user.id}`, label: "My profile", Icon: UserIcon },
                            { to: "/create", label: "Create agent", Icon: Cpu },
                            ...(user.isAdmin ? [{ to: "/admin", label: "Admin", Icon: Shield }] : []),
                          ].map(({ to, label, Icon }) => (
                            <button key={to} onClick={() => { setProfileOpen(false); nav(to); }}
                              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-slate-300 transition hover:bg-ink-800">
                              <Icon size={18} className="text-slate-400" /> {label}
                            </button>
                          ))}
                        </div>

                        <div className="border-t border-ink-700 pt-1.5">
                          <button onClick={() => { setProfileOpen(false); logout(); nav("/"); }}
                            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-down transition hover:bg-ink-800">
                            <LogOut size={18} /> Logout
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost !px-3 !py-1.5 text-xs">Sign in</Link>
                <Link to="/register" className="btn-primary !px-3 !py-1.5 text-xs">Get started</Link>
              </>
            )}
            <button className="md:hidden btn-ghost !px-2 !py-1.5" onClick={() => setMenu((m) => !m)}>☰</button>
          </div>
        </div>

        {menu && (
          <nav className="grid gap-1 border-t border-ink-700 px-4 py-2 md:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMenu(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-ink-800">
                {n.label}
              </NavLink>
            ))}
            {user?.isAdmin && (
              <NavLink to="/admin" onClick={() => setMenu(false)} className="rounded-lg px-3 py-2 text-sm text-brand-light hover:bg-ink-800">Admin</NavLink>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>

      <footer className="mt-12 border-t border-ink-700/70">
        <div className="mx-auto max-w-7xl px-4 py-8 text-xs leading-relaxed text-slate-500">
          <div className="flex items-center gap-2">
            <img src="/images/pai-logo.png" alt="" className="h-5 w-5 rounded-full" />
            <span className="font-semibold text-slate-400">PaiPalace</span>
          </div>
          <p className="mt-3 max-w-3xl">
            Deposits and withdrawals settle in <b>USDC on Solana</b> via your connected wallet.
            Real-money gambling is regulated — operating live requires the appropriate license and
            KYC/AML in each jurisdiction. Nothing here is financial advice. 18+ where applicable.
          </p>
        </div>
      </footer>

      {user && <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />}
    </div>
  );
}
