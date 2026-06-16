import { useEffect, useState } from "react";
import { api, type WalletInfo } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { connectPhantom, depositUsdc, hasPhantom } from "../lib/wallet";
import { usd, shortAddr } from "../lib/format";
import { Wallet as WalletIcon, Copy } from "./icons";

export default function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh } = useAuth();
  const [data, setData] = useState<WalletInfo | null>(null);
  const [amount, setAmount] = useState(100);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) { setMsg(""); api.wallet().then(setData); }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const linked = !!data?.walletAddress;

  const connect = async () => {
    setBusy(true); setMsg("");
    try { const a = await connectPhantom(); await api.linkWallet(a); await refresh(); await api.wallet().then(setData); setMsg("Wallet connected."); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const deposit = async () => {
    if (!(amount > 0)) return;
    setBusy(true); setMsg("Approve the USDC transfer in Phantom…");
    try {
      const sig = await depositUsdc(amount);
      setMsg("Confirming on-chain…");
      const res = await api.deposit(sig);
      await refresh(); await api.wallet().then(setData);
      setMsg(`Deposited ${usd(res.amountUsd * 1e6)} — confirmed on Solana.`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const copyAddr = async () => { if (data?.treasuryAddress) { await navigator.clipboard.writeText(data.treasuryAddress); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card animate-fade w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="relative text-center">
          <h2 className="text-xl font-bold">Deposit</h2>
          <p className="mt-0.5 text-sm text-slate-400">PaiPalace balance: <span className="font-semibold text-up">{usd(data?.balance ?? 0)}</span></p>
          <button onClick={onClose} className="absolute -right-1 -top-1 text-slate-400 hover:text-slate-100" aria-label="Close">✕</button>
        </div>

        {/* method */}
        <div className="mt-5 rounded-xl border border-brand/40 bg-brand/5 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/20 text-brand-light"><WalletIcon size={18} /></span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-100">USDC on Solana</div>
              <div className="text-xs text-slate-500">via Phantom · on-chain · instant</div>
            </div>
            {linked && <span className="font-mono text-xs text-slate-400">{shortAddr(data!.walletAddress)}</span>}
          </div>

          {!linked ? (
            <div className="mt-4">
              {hasPhantom() ? (
                <button className="btn-primary w-full" disabled={busy} onClick={connect}>Connect Phantom</button>
              ) : (
                <a className="btn-primary block w-full text-center" href="https://phantom.app/" target="_blank" rel="noreferrer">Install Phantom</a>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
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

        {/* manual deposit address */}
        {data?.treasuryAddress && (
          <button onClick={copyAddr} className="mt-3 flex w-full items-center justify-between rounded-xl border border-ink-700 bg-ink-850 p-3 text-left transition hover:border-ink-600">
            <div>
              <div className="text-sm font-medium text-slate-200">Or send USDC manually</div>
              <div className="font-mono text-xs text-slate-500">{shortAddr(data.treasuryAddress)} · tap to copy</div>
            </div>
            <span className="text-slate-400">{copied ? <span className="text-xs text-up">Copied</span> : <Copy size={16} />}</span>
          </button>
        )}

        {msg && <p className="mt-4 text-center text-xs text-brand-light">{msg}</p>}
        <p className="mt-3 text-center text-xs text-slate-500">Deposits are verified on-chain before crediting your balance.</p>
      </div>
    </div>
  );
}
