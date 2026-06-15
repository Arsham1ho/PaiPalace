import { useEffect, useState } from "react";
import { api, type Tx } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, Badge, Spinner } from "../components/ui";
import { usd, shortAddr, timeAgo } from "../lib/format";
import { connectWallet, hasInjectedWallet, IS_TESTNET, TARGET_CHAIN_ID } from "../lib/wallet";

const TX_TONE: Record<string, "green" | "red" | "ink" | "pink" | "cyan"> = {
  deposit: "green", winnings: "green", withdraw: "red", loss: "red",
  invest: "pink", divest: "cyan", buy_agent: "ink",
};

export default function Wallet() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState<{ balance: number; walletAddress: string; transactions: Tx[] } | null>(null);
  const [amount, setAmount] = useState(100);
  const [connected, setConnected] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.wallet().then(setData);
  useEffect(() => { load(); }, []);

  const act = async (kind: "deposit" | "withdraw") => {
    setBusy(true); setMsg("");
    try {
      // simulate an on-chain tx hash for the audit trail
      const fakeHash = "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
      if (kind === "deposit") await api.deposit(amount, fakeHash);
      else await api.withdraw(amount, fakeHash);
      await refresh(); await load();
      setMsg(`${kind === "deposit" ? "Deposited" : "Withdrew"} ${usd(amount * 1e6)}.`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const connect = async () => {
    setMsg("");
    try {
      const w = await connectWallet();
      setConnected(w.address);
      if (w.chainId !== TARGET_CHAIN_ID) setMsg(`Connected on chain ${w.chainId}. Switch to chain ${TARGET_CHAIN_ID} for deposits.`);
    } catch (e: any) { setMsg(e.message); }
  };

  if (!data) return <Spinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-pai-cyan/20 blur-2xl" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wide text-slate-500">Available balance</div>
            <div className="mt-1 text-4xl font-extrabold">{usd(data.balance)}</div>
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
              <Badge color="cyan">{IS_TESTNET ? "Testnet" : "Mainnet"}</Badge>
              <span className="font-mono">{data.walletAddress}</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Deposit / Withdraw</h2>
            {hasInjectedWallet() ? (
              <button className="btn-ghost !py-1.5 text-xs" onClick={connect}>
                {connected ? `🟢 ${shortAddr(connected)}` : "Connect wallet"}
              </button>
            ) : (
              <span className="text-[11px] text-slate-500">No browser wallet detected</span>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <input type="number" min={1} className="input" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <button className="btn-primary whitespace-nowrap" disabled={busy} onClick={() => act("deposit")}>Deposit</button>
            <button className="btn-ghost whitespace-nowrap" disabled={busy} onClick={() => act("withdraw")}>Withdraw</button>
          </div>
          <div className="mt-2 flex gap-2">
            {[100, 500, 1000].map((v) => (
              <button key={v} onClick={() => setAmount(v)} className="btn-ghost flex-1 !py-1.5 text-xs">${v}</button>
            ))}
          </div>
          {msg && <p className="mt-3 text-xs text-pai-cyan">{msg}</p>}
          <p className="mt-3 text-[11px] text-slate-500">
            On testnet, deposits are credited instantly for testing. Mainnet flows require the deployed escrow
            contract and an audited settlement path.
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Transaction history</h2>
        <div className="mt-3 space-y-2">
          {data.transactions.length ? data.transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-850/40 p-3 text-sm">
              <div>
                <Badge color={TX_TONE[t.type] ?? "ink"}>{t.type}</Badge>
                <div className="mt-1 text-[11px] text-slate-500">
                  {timeAgo(t.createdAt)}{t.txHash ? ` · ${shortAddr(t.txHash)}` : ""}
                </div>
              </div>
              <span className={`font-semibold ${["deposit", "winnings"].includes(t.type) ? "text-up" : ["withdraw", "loss", "invest", "buy_agent"].includes(t.type) ? "text-down" : "text-slate-300"}`}>
                {["deposit", "winnings"].includes(t.type) ? "+" : "-"}{usd(t.amount)}
              </span>
            </div>
          )) : <p className="text-sm text-slate-500">No transactions yet.</p>}
        </div>
      </Card>
    </div>
  );
}
