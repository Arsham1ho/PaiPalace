import { useEffect, useState } from "react";
import { api, type WalletInfo } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { connectWallet, depositUsdc, walletOptions, type WalletKey } from "../lib/wallet";
import { usd, shortAddr } from "../lib/format";
import { Copy } from "./icons";

const QR = (addr: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=190x190&margin=8&bgcolor=0e1016&color=ffffff&data=${encodeURIComponent(addr)}`;

export default function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh } = useAuth();
  const [data, setData] = useState<WalletInfo | null>(null);
  const [tab, setTab] = useState<"connect" | "address">("connect");
  const [wallet, setWallet] = useState<WalletKey | null>(null);
  const [connected, setConnected] = useState<string | null>(null);
  const [amount, setAmount] = useState(100);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const reload = () => api.wallet().then(setData);
  useEffect(() => { if (open) { setMsg(""); reload(); } }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const options = walletOptions();

  const connect = async (key: WalletKey) => {
    setBusy(true); setMsg("");
    try {
      const addr = await connectWallet(key);
      await api.linkWallet(addr);
      setWallet(key); setConnected(addr); await refresh(); await reload();
      setMsg(`Connected ${shortAddr(addr)}`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const deposit = async () => {
    if (!wallet || !(amount > 0)) return;
    setBusy(true); setMsg("Approve the USDC transfer in your wallet…");
    try {
      const sig = await depositUsdc(wallet, amount);
      setMsg("Confirming on-chain…");
      const res = await api.deposit(sig);
      await refresh(); await reload();
      setMsg(`Deposited ${usd(res.amountUsd * 1e6)} — confirmed.`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const sync = async () => {
    setBusy(true); setMsg("Checking the blockchain for your deposit…");
    try {
      const res = await api.syncDeposits();
      await refresh(); await reload();
      setMsg(res.credited > 0 ? `Credited ${usd(res.credited)} 🎉` : "No new deposits found yet. It can take a moment to confirm.");
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const copyDeposit = async () => { if (data?.depositAddress) { await navigator.clipboard.writeText(data.depositAddress); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card animate-fade w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="relative text-center">
          <h2 className="text-xl font-bold">Deposit</h2>
          <p className="mt-0.5 text-sm text-slate-400">Balance: <span className="font-semibold text-up">{usd(data?.balance ?? 0)}</span></p>
          <button onClick={onClose} className="absolute -right-1 -top-1 text-slate-400 hover:text-slate-100" aria-label="Close">✕</button>
        </div>

        {/* method tabs */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-ink-850 p-1">
          <button onClick={() => setTab("connect")} className={`rounded-lg py-2 text-sm font-medium transition ${tab === "connect" ? "bg-ink-700 text-white" : "text-slate-400"}`}>Connect wallet</button>
          <button onClick={() => setTab("address")} className={`rounded-lg py-2 text-sm font-medium transition ${tab === "address" ? "bg-ink-700 text-white" : "text-slate-400"}`}>Deposit address</button>
        </div>

        {/* method 1: connect wallet */}
        {tab === "connect" && (
          <div className="mt-4">
            {!connected ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Connect a Solana wallet to deposit USDC.</p>
                {options.map((o) => (
                  o.installed ? (
                    <button key={o.key} disabled={busy} onClick={() => connect(o.key)}
                      className="flex w-full items-center justify-between rounded-xl border border-ink-700 bg-ink-850 p-3 text-left transition hover:border-brand/60">
                      <span className="text-sm font-semibold text-slate-100">{o.name}</span>
                      <span className="text-xs text-brand-light">Connect</span>
                    </button>
                  ) : (
                    <a key={o.key} href={o.url} target="_blank" rel="noreferrer"
                      className="flex w-full items-center justify-between rounded-xl border border-ink-800 bg-ink-900 p-3 text-left transition hover:border-ink-600">
                      <span className="text-sm font-medium text-slate-400">{o.name}</span>
                      <span className="text-xs text-slate-500">Install ↗</span>
                    </a>
                  )
                ))}
                <p className="pt-1 text-[11px] text-slate-600">MetaMask is Ethereum-only; PaiPalace settles in USDC on Solana.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-850 p-3 text-sm">
                  <span className="text-slate-300">{wallet}</span>
                  <span className="font-mono text-xs text-up">{shortAddr(connected)}</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input !pl-6" />
                  </div>
                  <button className="btn-primary whitespace-nowrap" disabled={busy || !data?.solanaConfigured} onClick={deposit}>Deposit USDC</button>
                </div>
                <div className="flex gap-2">
                  {[25, 100, 500, 1000].map((v) => (
                    <button key={v} onClick={() => setAmount(v)} className={`flex-1 rounded-lg border py-1.5 text-xs transition ${amount === v ? "border-brand bg-brand/10 text-brand-light" : "border-ink-700 text-slate-400 hover:border-ink-600"}`}>${v}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* method 2: deposit address */}
        {tab === "address" && (
          <div className="mt-4">
            {data?.depositAddress ? (
              <div className="flex flex-col items-center text-center">
                <p className="text-xs text-slate-500">Send <span className="font-semibold text-slate-300">USDC (Solana)</span> to your personal deposit address. Only send USDC on Solana.</p>
                <img src={QR(data.depositAddress)} alt="deposit address QR" className="mt-3 rounded-xl border border-ink-700" width={190} height={190} />
                <button onClick={copyDeposit} className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-ink-700 bg-ink-850 p-3 text-left transition hover:border-ink-600">
                  <span className="break-all font-mono text-xs text-slate-300">{data.depositAddress}</span>
                  <span className="shrink-0 text-slate-400">{copied ? <span className="text-xs text-up">Copied</span> : <Copy size={16} />}</span>
                </button>
                <button className="btn-primary mt-3 w-full" disabled={busy} onClick={sync}>I've sent it — check for deposit</button>
              </div>
            ) : <p className="text-sm text-slate-500">Generating your deposit address…</p>}
          </div>
        )}

        {msg && <p className="mt-4 text-center text-xs text-brand-light">{msg}</p>}
        <p className="mt-3 text-center text-[11px] text-slate-500">Deposits are verified on-chain before crediting your balance.</p>
      </div>
    </div>
  );
}
