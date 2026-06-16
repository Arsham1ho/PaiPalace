import { NavLink, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { usd, shortAddr } from "../lib/format";
import { ChevronDown } from "./icons";

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
                    <div className="text-[11px] text-slate-400">Portfolio</div>
                    <div className="text-sm font-bold text-up">{usd(portfolioValue ?? user.balance)}</div>
                  </Link>
                  <Link to="/wallet" className="text-center leading-tight">
                    <div className="text-[11px] text-slate-400">Cash</div>
                    <div className="text-sm font-bold text-up">{usd(user.balance)}</div>
                  </Link>
                </div>
                <Link to="/wallet" className="btn-primary !px-4 !py-2 text-sm">Deposit</Link>

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
                      <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 p-1 shadow-xl">
                        <div className="flex items-center gap-3 px-3 py-3">
                          <img src={userAvatar(user.username)} alt="" className="h-10 w-10 rounded-full border border-ink-700 bg-ink-800" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-100">{user.username}</div>
                            <div className="truncate text-[11px] text-slate-500">{user.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-3 pb-2">
                          <span className="text-[11px] text-slate-500">Balance</span>
                          <span className="text-sm font-semibold text-up">{usd(user.balance)}</span>
                        </div>
                        {user.walletAddress && (
                          <div className="flex items-center justify-between px-3 pb-2">
                            <span className="text-[11px] text-slate-500">Wallet</span>
                            <span className="font-mono text-[11px] text-slate-400">{shortAddr(user.walletAddress)}</span>
                          </div>
                        )}
                        <div className="my-1 h-px bg-ink-700" />
                        {[["/portfolio", "Portfolio"], ["/wallet", "Wallet"], ...(user.isAdmin ? [["/admin", "Admin"]] : [])].map(([to, label]) => (
                          <button key={to} onClick={() => { setProfileOpen(false); nav(to); }}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-ink-800">
                            {label}
                          </button>
                        ))}
                        <div className="my-1 h-px bg-ink-700" />
                        <button onClick={() => { setProfileOpen(false); logout(); nav("/"); }}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-down hover:bg-ink-800">
                          Sign out
                        </button>
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
    </div>
  );
}
