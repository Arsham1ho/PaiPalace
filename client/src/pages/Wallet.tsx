import { useEffect, useState } from "react";
import { api, type WalletInfo } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, Badge, Spinner } from "../components/ui";
import { Dot } from "../components/icons";
import { usd, shortAddr, timeAgo } from "../lib/format";
import { connectPhantom, depositUsdc, hasPhantom } from "../lib/wallet";

const TX_TONE: Record<string, "green" | "red" | "ink" | "pink" | "cyan"> = {
  deposit: "green", winnings: "green", withdraw: "red", loss: "red",
  invest: "pink", divest: "cyan", buy_agent: "ink", admin_adjust: "cyan",
};
const EXPLORER = (sig: string) => `https://solscan.io/tx/${sig}`;

export default function Wallet() {
  const { refresh } = useAuth();
  const [data, setData] = useState<WalletInfo | null>(null);
  const [amount, setAmount] = useState(100);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.wallet().then(setData);
  useEffect(() => { load(); }, []);

  const connect = async () => {
    setMsg(""); setBusy(true);
    try {
      const address = await connectPhantom();
      await api.linkWallet(address);
      await refresh(); await load();
      setMsg(`Wallet connected: ${shortAddr(address)}`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const deposit = async () => {
    if (!(amount > 0)) return;
    setBusy(true); setMsg("Approve the USDC transfer in Phantom…");
    try {
      const signature = await depositUsdc(amount);    // real on-chain USDC transfer (user-signed)
      setMsg("Confirming on-chain…");
      const res = await api.deposit(signature);        // server verifies & credits
      await refresh(); await load();
      setMsg(`Deposited ${usd(res.amountUsd * 1e6)} — confirmed on Solana.`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const withdraw = async () => {
    if (!(amount > 0)) return;
    setBusy(true); setMsg("Sending USDC to your wallet…");
    try {
      const res = await api.withdraw(amount);
      await refresh(); await load();
      setMsg(`Withdrew ${usd(amount * 1e6)} — tx ${shortAddr(res.signature)}`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  if (!data) return <Spinner />;
  const linked = !!data.walletAddress;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/20 blur-2xl" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wide text-slate-500">Available balance</div>
            <div className="mt-1 text-4xl font-extrabold">{usd(data.balance)}</div>
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
              <Badge color="cyan">USDC · Solana</Badge>
              {linked ? <span className="font-mono">{data.walletAddress}</span> : <span className="text-slate-500">No wallet connected</span>}
            </div>
          </div>
        </Card>

        {!linked ? (
          <Card>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Connect your wallet</h2>
            <p className="mt-1 text-sm text-slate-400">
              Connect your Phantom (Solana) wallet. Your wallet address becomes your deposit & withdrawal address —
              non-custodial: you sign every transaction yourself.
            </p>
            {hasPhantom() ? (
              <button className="btn-primary mt-4" disabled={busy} onClick={connect}>Connect Phantom</button>
            ) : (
              <a className="btn-primary mt-4 inline-flex" href="https://phantom.app/" target="_blank" rel="noreferrer">Install Phantom</a>
            )}
            {msg && <p className="mt-3 text-xs text-brand-light">{msg}</p>}
          </Card>
        ) : (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Deposit / Withdraw USDC</h2>
              <span className="inline-flex items-center gap-1.5 text-xs text-up"><Dot className="text-up" /> {shortAddr(data.walletAddress)}</span>
            </div>
            <div className="mt-4 flex gap-2">
              <input type="number" min={1} className="input" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              <button className="btn-primary whitespace-nowrap" disabled={busy || !data.solanaConfigured} onClick={deposit}>Deposit</button>
              <button className="btn-ghost whitespace-nowrap" disabled={busy || !data.withdrawalsEnabled} onClick={withdraw}>Withdraw</button>
            </div>
            <div className="mt-2 flex gap-2">
              {[25, 100, 500].map((v) => (
                <button key={v} onClick={() => setAmount(v)} className="btn-ghost flex-1 !py-1.5 text-xs">${v}</button>
              ))}
            </div>
            {msg && <p className="mt-3 text-xs text-brand-light">{msg}</p>}
            <p className="mt-3 text-xs text-slate-500">
              Deposits send USDC from your wallet to the platform treasury and are verified on-chain before crediting.
              {!data.withdrawalsEnabled && " Withdrawals are paused until the treasury is funded/configured."}
            </p>
            {data.treasuryAddress && (
              <p className="mt-1 break-all text-xs text-slate-600">Treasury: {data.treasuryAddress}</p>
            )}
          </Card>
        )}
      </div>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Transaction history</h2>
        <div className="mt-3 space-y-2">
          {data.transactions.length ? data.transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-850/40 p-3 text-sm">
              <div>
                <Badge color={TX_TONE[t.type] ?? "ink"}>{t.type.replace("_", " ")}</Badge>
                <div className="mt-1 text-xs text-slate-500">
                  {timeAgo(t.createdAt)}
                  {t.txHash ? <> · <a className="text-brand-light hover:underline" href={EXPLORER(t.txHash)} target="_blank" rel="noreferrer">{shortAddr(t.txHash)}</a></> : ""}
                </div>
              </div>
              <span className={`font-semibold ${["deposit", "winnings"].includes(t.type) ? "text-up" : ["withdraw", "loss", "invest", "buy_agent"].includes(t.type) ? "text-down" : "text-slate-300"}`}>
                {["deposit", "winnings"].includes(t.type) ? "+" : ["withdraw", "loss", "invest", "buy_agent"].includes(t.type) ? "-" : ""}{usd(t.amount)}
              </span>
            </div>
          )) : <p className="text-sm text-slate-500">No transactions yet.</p>}
        </div>
      </Card>
    </div>
  );
}
