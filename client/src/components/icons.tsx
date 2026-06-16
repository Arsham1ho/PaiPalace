// Small inline SVG icons — no emoji anywhere in the UI.
type P = { className?: string; size?: number };
const base = (size = 16) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const Bolt = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></svg>
);
export const Chip = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>
);
export const Play = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M6 4l14 8-14 8V4Z" /></svg>
);
export const Trophy = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM7 4H4v2a3 3 0 0 0 3 3M17 4h3v2a3 3 0 0 1-3 3" /></svg>
);
export const Cpu = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></svg>
);
export const Shield = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z" /></svg>
);
export const Wallet = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M16 12h3M16 12a1.5 1.5 0 0 0 0 3h4v-3" /></svg>
);
export const Users = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0M17 5a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-5-6.7" /></svg>
);
export const Dot = ({ className, size = 8 }: P) => (
  <svg width={size} height={size} viewBox="0 0 8 8" className={className}><circle cx="4" cy="4" r="4" fill="currentColor" /></svg>
);
export const Gift = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S11 2 7.5 2 5 5.5 8 7M12 7s1-5 4.5-5S19 5.5 16 7" /></svg>
);
export const Bell = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
);
export const ChevronDown = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="m6 9 6 6 6-6" /></svg>
);
export const ChevronRight = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="m9 6 6 6-6 6" /></svg>
);
export const Settings = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
);
export const UserIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);
export const LogOut = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
);
export const Chart = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M3 3v18h18M7 14l4-4 3 3 5-6" /></svg>
);
export const Copy = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);
export const Volume = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
);
export const VolumeOff = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>
);
