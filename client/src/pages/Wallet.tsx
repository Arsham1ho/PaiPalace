import { useEffect, useState } from "react";
import { api, type WalletInfo } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, Badge, Spinner } from "../components/ui";
import { Copy } from "../components/icons";
import { usd, shortAddr, timeAgo } from "../lib/format";
import DepositModal from "../components/DepositModal";

const TX_TONE: Record<string, "green" | "red" | "ink" | "pink" | "cyan"> = {
  deposit: "green", winnings: "green", withdraw: "red", loss: "red",
  invest: "pink", divest: "cyan", buy_agent: "ink", admin_adjust: "cyan",
};
const EXPLORER = (sig: string) => `https://solscan.io/tx/${sig}`;
const isPlus = (t: string) => ["deposit", "winnings"].includes(t);
const isMinus = (t: string) => ["withdraw", "loss", "invest", "buy_agent"].includes(t);

export default function Wallet() {
  const { refresh } = useAuth();
  const [data, setData] = useState<WalletInfo | null>(null);
  const [amount, setAmount] = useState(100);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => api.wallet().then(setData);
  useEffect(() => { load(); }, []);

  const withdraw = async () => {
    if (!(amount > 0)) return;
    setBusy(true); setMsg("Sending USDC to your wallet…");
    try {
      const res = await api.withdraw(amount);
      await refresh(); await load();
      setMsg(`Withdrew ${usd(amount * 1e6)} — tx ${shortAddr(res.signature)}`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const copyDeposit = async () => { if (data?.depositAddress) { await navigator.clipboard.writeText(data.depositAddress); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  if (!data) return <Spinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/15 blur-2xl" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wide text-slate-500">Available balance</div>
            <div className="tabular mt-1 text-4xl font-extrabold">{usd(data.balance)}</div>
            <div className="mt-3"><Badge color="cyan">USDC · Solana</Badge></div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Deposit & withdraw</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setDepositOpen(true)}>Deposit</button>
          </div>

          <div className="mt-4 border-t border-ink-800 pt-4">
            <div className="text-xs text-slate-400">Withdraw to your connected wallet</div>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input type="number" min={1} className="input !pl-6" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              </div>
              <button className="btn-ghost whitespace-nowrap" disabled={busy || !data.walletAddress || !data.withdrawalsEnabled} onClick={withdraw}>Withdraw</button>
            </div>
            {!data.walletAddress && <p className="mt-2 text-xs text-slate-500">Connect a wallet (via Deposit) to enable withdrawals.</p>}
          </div>
          {msg && <p className="mt-3 text-xs text-brand-light">{msg}</p>}
        </Card>

        {/* personal deposit address */}
        {data.depositAddress && (
          <Card>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Your deposit address</h2>
            <p className="mt-1 text-xs text-slate-500">Send USDC (Solana) here to top up directly. Unique to your account.</p>
            <button onClick={copyDeposit} className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-ink-700 bg-ink-850 p-3 text-left transition hover:border-ink-600">
              <span className="break-all font-mono text-xs text-slate-300">{data.depositAddress}</span>
              <span className="shrink-0 text-slate-400">{copied ? <span className="text-xs text-up">Copied</span> : <Copy size={16} />}</span>
            </button>
            <button className="btn-ghost mt-2 w-full" disabled={busy} onClick={async () => {
              setBusy(true); setMsg("Checking the blockchain…");
              try { const r = await api.syncDeposits(); await refresh(); await load(); setMsg(r.credited > 0 ? `Credited ${usd(r.credited)}` : "No new deposits found yet."); }
              catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
            }}>Check for deposits</button>
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
              <span className={`tabular font-semibold ${isPlus(t.type) ? "text-up" : isMinus(t.type) ? "text-down" : "text-slate-300"}`}>
                {isPlus(t.type) ? "+" : isMinus(t.type) ? "-" : ""}{usd(t.amount)}
              </span>
            </div>
          )) : <p className="text-sm text-slate-500">No transactions yet.</p>}
        </div>
      </Card>

      <DepositModal open={depositOpen} onClose={() => { setDepositOpen(false); load(); }} />
    </div>
  );
}
