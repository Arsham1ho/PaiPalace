import { NavLink, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { usd, shortAddr } from "../lib/format";

const NAV = [
  { to: "/", label: "Leaderboard", end: true },
  { to: "/live", label: "Live & Past Games" },
  { to: "/create", label: "Create Agent" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/wallet", label: "Wallet" },
  { to: "/players", label: "Players" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-ink-700/70 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/images/pai-logo.png" alt="PaiPalace" className="h-9 w-9 rounded-full" />
            <span className="text-lg font-extrabold tracking-tight">
              Pai<span className="brand-gradient">Palace</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? "bg-ink-800 text-white" : "text-slate-400 hover:text-slate-100"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-semibold text-up">{usd(user.balance)}</div>
                  <div className="text-[11px] text-slate-500">{shortAddr(user.walletAddress)}</div>
                </div>
                <Link to="/wallet" className="btn-primary !px-3 !py-1.5 text-xs">Deposit</Link>
                <button
                  onClick={() => { logout(); nav("/"); }}
                  className="btn-ghost !px-3 !py-1.5 text-xs"
                >
                  Sign out
                </button>
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
            ⚠️ Prototype / demo. Wallet, deposits and on-chain settlement run on a <b>testnet by default</b>.
            Real-money on-chain gambling is heavily regulated and requires audited smart contracts, a license,
            and KYC/AML before going live. Nothing here is financial advice. 18+ where applicable.
          </p>
        </div>
      </footer>
    </div>
  );
}
