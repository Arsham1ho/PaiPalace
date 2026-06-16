import { useEffect, useState } from "react";
import { api, type WalletInfo } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { connectWallet, walletOptions, type WalletKey } from "../lib/wallet";
import { usd, shortAddr } from "../lib/format";

export default function WithdrawModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh } = useAuth();
  const [data, setData] = useState<WalletInfo | null>(null);
  const [amount, setAmount] = useState(50);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => api.wallet().then(setData);
  useEffect(() => { if (open) { setMsg(""); reload(); } }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const balance = (data?.balance ?? 0) / 1e6;
  const linked = !!data?.walletAddress;

  const connect = async (key: WalletKey) => {
    setBusy(true); setMsg("");
    try { const a = await connectWallet(key); await api.linkWallet(a); await refresh(); await reload(); setMsg(`Connected ${shortAddr(a)}`); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const withdraw = async () => {
    if (!(amount > 0)) return;
    setBusy(true); setMsg("Sending USDC to your wallet…");
    try {
      const res = await api.withdraw(amount);
      await refresh(); await reload();
      setMsg(`Withdrew ${usd(amount * 1e6)} — tx ${shortAddr(res.signature)}`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const options = walletOptions();

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card animate-fade w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="relative text-center">
          <h2 className="text-xl font-bold">Withdraw</h2>
          <p className="mt-0.5 text-sm text-slate-400">Available: <span className="font-semibold text-up">{usd(data?.balance ?? 0)}</span></p>
          <button onClick={onClose} className="absolute -right-1 -top-1 text-slate-400 hover:text-slate-100" aria-label="Close">✕</button>
        </div>

        {!linked ? (
          <div className="mt-5 space-y-2">
            <p className="text-xs text-slate-500">Connect the wallet you want to withdraw USDC to.</p>
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
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-850 p-3 text-sm">
              <span className="text-slate-400">To</span>
              <span className="font-mono text-xs text-slate-300">{shortAddr(data!.walletAddress)}</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input !pl-6" />
              </div>
              <button className="btn-primary whitespace-nowrap" disabled={busy || !data?.withdrawalsEnabled || amount > balance} onClick={withdraw}>Withdraw</button>
            </div>
            <div className="flex gap-2">
              {[25, 50, 100].map((v) => (
                <button key={v} onClick={() => setAmount(v)} className="flex-1 rounded-lg border border-ink-700 py-1.5 text-xs text-slate-400 transition hover:border-ink-600">${v}</button>
              ))}
              <button onClick={() => setAmount(Math.floor(balance))} className="flex-1 rounded-lg border border-ink-700 py-1.5 text-xs text-slate-400 transition hover:border-ink-600">Max</button>
            </div>
            {!data?.withdrawalsEnabled && <p className="text-xs text-slate-500">Withdrawals are temporarily unavailable (treasury not funded).</p>}
            {amount > balance && <p className="text-xs text-down">Amount exceeds your balance.</p>}
          </div>
        )}

        {msg && <p className="mt-4 text-center text-xs text-brand-light">{msg}</p>}
        <p className="mt-3 text-center text-[11px] text-slate-500">USDC is sent on Solana to your connected wallet.</p>
      </div>
    </div>
  );
}
