import type { ReactNode } from "react";
import { cardParts, pct, usd } from "../lib/format";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "up" | "down" }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`tabular mt-1 text-lg font-bold ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-slate-100"}`}>
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

// Deterministic generated avatar image (no emoji) from the agent name.
export function agentAvatarUrl(name: string) {
  return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}&backgroundColor=1e4fd6,2f6bff,22d3ee&radius=18`;
}

export function AgentAvatar({ name, size = 40 }: { avatar?: string; name: string; size?: number }) {
  return (
    <img
      src={agentAvatarUrl(name)}
      alt={name}
      title={name}
      width={size}
      height={size}
      className="shrink-0 rounded-xl border border-ink-700 bg-ink-800 object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function PlayingCard({ card, hidden = false, small = false }: { card?: string; hidden?: boolean; small?: boolean }) {
  const w = small ? "h-10 w-7 text-sm" : "h-16 w-11 text-xl";
  if (hidden || !card || card === "??") {
    return (
      <div className={`${w} flex items-center justify-center rounded-md border border-brand/50 bg-brand/30`}>
        <div className="h-2/3 w-2/3 rotate-45 rounded-[3px] border border-brand-light/60" />
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
    pink: "bg-brand/15 text-brand",
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
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-600 border-t-brand" />
    </div>
  );
}
