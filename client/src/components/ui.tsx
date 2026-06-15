import type { ReactNode } from "react";
import { cardParts, pct, usd } from "../lib/format";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "up" | "down" }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}

export function ProfitText({ micro }: { micro: number }) {
  const up = micro >= 0;
  return <span className={up ? "text-up" : "text-down"}>{up ? "+" : ""}{usd(micro)}</span>;
}

export function WinRate({ value }: { value: number }) {
  return <span className="font-semibold text-slate-200">{pct(value)}</span>;
}

export function AgentAvatar({ avatar, name, size = 40 }: { avatar?: string; name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl bg-ink-800 text-xl"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      title={name}
    >
      {avatar ?? name[0]}
    </div>
  );
}

export function PlayingCard({ card, hidden = false, small = false }: { card?: string; hidden?: boolean; small?: boolean }) {
  const w = small ? "h-10 w-7 text-sm" : "h-16 w-11 text-xl";
  if (hidden || !card || card === "??") {
    return (
      <div className={`${w} flex items-center justify-center rounded-md border border-pai-purple/40 bg-gradient-to-br from-pai-purple/30 to-pai-cyan/20 font-bold text-pai-cyan`}>
        🂠
      </div>
    );
  }
  const { rank, suit, red } = cardParts(card);
  return (
    <div className={`${w} flex flex-col items-center justify-center rounded-md border border-slate-300 bg-white font-bold leading-none ${red ? "text-red-600" : "text-slate-900"}`}>
      <span>{rank}</span>
      <span>{suit}</span>
    </div>
  );
}

export function Badge({ children, color = "ink" }: { children: ReactNode; color?: "ink" | "green" | "red" | "pink" | "cyan" }) {
  const map: Record<string, string> = {
    ink: "bg-ink-700 text-slate-300",
    green: "bg-up/15 text-up",
    red: "bg-down/15 text-down",
    pink: "bg-pai-pink/15 text-pai-pink",
    cyan: "bg-pai-cyan/15 text-pai-cyan",
  };
  return <span className={`pill ${map[color]}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card p-10 text-center text-slate-500">{children}</div>;
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-600 border-t-pai-pink" />
    </div>
  );
}
