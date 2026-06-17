const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

let token: string | null = localStorage.getItem("pp_token");

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("pp_token", t);
  else localStorage.removeItem("pp_token");
}
export function getToken() {
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error?.formErrors?.[0] ?? (data as any)?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  base: BASE,
  // auth
  register: (body: { email: string; username: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request<{ user: User }>("/auth/me"),
  updateUsername: (username: string) =>
    request<{ user: User }>("/auth/account", { method: "PATCH", body: JSON.stringify({ username }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/auth/account/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  // agents
  agents: (sort = "profit") => request<Agent[]>(`/api/agents?sort=${sort}`),
  myAgents: () => request<Agent[]>("/api/agents/mine"),
  agent: (id: string) => request<Agent>(`/api/agents/${id}`),
  agentPerformance: (id: string) => request<AgentPerformance>(`/api/agents/${id}/performance`),
  createAgent: (body: any) => request<Agent>("/api/agents", { method: "POST", body: JSON.stringify(body) }),
  checkAgentName: (name: string) => request<{ available: boolean }>(`/api/agents/check-name?name=${encodeURIComponent(name)}`),
  improvePrompt: (prompt: string) => request<{ prompt: string; engine: string }>("/api/agents/improve-prompt", { method: "POST", body: JSON.stringify({ prompt }) }),
  buyAgent: (id: string) => request(`/api/agents/${id}/buy`, { method: "POST" }),
  updateAgent: (id: string, body: any) => request<Agent>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAgent: (id: string) => request<{ ok: boolean }>(`/api/agents/${id}`, { method: "DELETE" }),
  invest: (id: string, amountUsd: number) =>
    request(`/api/agents/${id}/invest`, { method: "POST", body: JSON.stringify({ amountUsd }) }),
  // wallet (Solana USDC)
  wallet: () => request<WalletInfo>("/api/wallet"),
  linkWallet: (address: string) =>
    request<{ ok: boolean; walletAddress: string }>("/api/wallet/link", { method: "POST", body: JSON.stringify({ address }) }),
  deposit: (signature: string) =>
    request<{ ok: boolean; amountUsd: number }>("/api/wallet/deposit", { method: "POST", body: JSON.stringify({ signature }) }),
  syncDeposits: () => request<{ ok: boolean; credited: number }>("/api/wallet/deposit/sync", { method: "POST" }),
  withdraw: (amountUsd: number) =>
    request<{ ok: boolean; signature: string }>("/api/wallet/withdraw", { method: "POST", body: JSON.stringify({ amountUsd }) }),
  // portfolio
  portfolio: () => request<Portfolio>("/api/portfolio"),
  // games
  games: (status?: string) => request<Game[]>(`/api/games${status ? `?status=${status}` : ""}`),
  game: (id: string) => request<GameDetail>(`/api/games/${id}`),
  createGame: (body: any) => request<Game>("/api/games", { method: "POST", body: JSON.stringify(body) }),
  testMatch: (agentId: string) => request<Game>("/api/games/test", { method: "POST", body: JSON.stringify({ agentId }) }),
  // rooms (multiplayer)
  rooms: () => request<RoomSummary[]>("/api/rooms"),
  room: (id: string) => request<RoomDetail>(`/api/rooms/${id}`),
  roomByCode: (code: string) => request<{ id: string }>(`/api/rooms/code/${code}`),
  createRoom: (body: any) => request<{ id: string; roomCode: string }>("/api/rooms", { method: "POST", body: JSON.stringify(body) }),
  joinRoom: (id: string, body: any) => request(`/api/rooms/${id}/join`, { method: "POST", body: JSON.stringify(body) }),
  startRoom: (id: string) => request(`/api/rooms/${id}/start`, { method: "POST" }),
  addRoomBot: (id: string) => request(`/api/rooms/${id}/add-bot`, { method: "POST" }),
  // users
  users: () => request<PublicUser[]>("/api/users"),
  user: (id: string) => request<PublicUserDetail>(`/api/users/${id}`),
  leaderboard: (period = "all") => request<AccountRow[]>(`/api/leaderboard?period=${period}`),
  stats: () => request<PlatformStats>("/api/stats"),
  // admin
  adminStats: () => request<AdminStats>("/api/admin/stats"),
  adminUsers: () => request<AdminUser[]>("/api/admin/users"),
  adminSetBalance: (id: string, setUsd: number) =>
    request(`/api/admin/users/${id}/balance`, { method: "POST", body: JSON.stringify({ setUsd }) }),
  adminBan: (id: string, banned: boolean) =>
    request(`/api/admin/users/${id}/ban`, { method: "POST", body: JSON.stringify({ banned }) }),
  adminToggleAdmin: (id: string, isAdmin: boolean) =>
    request(`/api/admin/users/${id}/admin`, { method: "POST", body: JSON.stringify({ isAdmin }) }),
  adminDeleteUser: (id: string) => request(`/api/admin/users/${id}`, { method: "DELETE" }),
};

export interface WalletInfo {
  balance: number;
  walletAddress: string | null;
  depositAddress: string | null;
  treasuryAddress: string | null;
  solanaConfigured: boolean;
  withdrawalsEnabled: boolean;
  transactions: Tx[];
}
export interface AdminStats {
  users: number; agents: number; games: number; decisions: number;
  totalBalance: number; totalDeposits: number; totalWithdrawals: number;
}
export interface AdminUser {
  id: string; email: string; username: string; walletAddress: string | null;
  balance: number; isAdmin: boolean; banned: boolean; createdAt: string;
  agents: number; investments: number; transactions: number;
}

// ---- types ----
export interface User {
  id: string;
  email: string;
  username: string;
  walletAddress: string | null;
  balance: number;
  isAdmin?: boolean;
  createdAt: string;
}
export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  prompt: string;
  params: string;
  ownerId?: string | null;
  owner?: { id: string; username: string } | null;
  forSale: boolean;
  price: number;
  handsPlayed: number;
  handsWon: number;
  netProfit: number;
  elo: number;
  winRate: number;
  createdAt: string;
  decisions?: Decision[];
  investments?: any[];
  fielders?: { id: string; username: string }[];
  bought?: boolean;
  _count?: { investments: number };
}
export interface AgentPerformance {
  series: { t: string; gameId: string; name: string; netMicro: number; cumMicro: number }[];
  record: { games: number; wins: number; losses: number; profitMicro: number; lossMicro: number; netMicro: number };
}
export interface Decision {
  id: string;
  agentId: string;
  handNumber: number;
  street: string;
  action: string;
  amount: number;
  reasoning: string;
  engine: string;
  createdAt: string;
  agent?: { name: string };
}
export interface Tx {
  id: string;
  type: string;
  amount: number;
  txHash?: string | null;
  meta: string;
  createdAt: string;
}
export interface Game {
  id: string;
  name: string;
  status: string;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  handNumber: number;
  practice?: boolean;
  winnerAgent?: string | null;
  createdAt: string;
  finishedAt?: string | null;
  seats?: { agentId: string; seatIndex: number; agent: { name: string; avatar?: string } }[];
}
export interface GameDetail extends Game {
  seats: any[];
  decisions: Decision[];
  live: any | null;
}
export interface Portfolio {
  balance: number;
  investments: { id: string; amount: number; agent: Agent }[];
  ownedAgents: Agent[];
  series: { t: string; value: number; type: string }[];
}
export interface RoomSummary {
  id: string; name: string; players: number; maxPlayers: number;
  entryMicro: number; prizePool: number; smallBlind: number; bigBlind: number;
  visibility: string; status: string; createdAt: string;
  seats: { seatIndex: number; agent: { name: string; avatar?: string } }[];
}
export interface RoomDetail {
  id: string; name: string; status: string; visibility: string; roomCode: string | null;
  entryMicro: number; prizePool: number; smallBlind: number; bigBlind: number;
  hostId: string | null; isHost: boolean; needsPassword: boolean; joined: boolean; maxPlayers: number;
  players: { seatIndex: number; userId: string | null; username?: string; agent: { name: string; avatar?: string } }[];
}
export interface PlatformStats {
  agents: number; players: number; games: number; decisions: number; liveGames: number; hands: number;
}
export interface AccountRow {
  id: string;
  username: string;
  walletAddress: string | null;
  createdAt: string;
  agents: number;
  investments: number;
  profit: number;
  volume: number;
}
export interface PublicUser {
  id: string;
  username: string;
  walletAddress: string | null;
  balance: number;
  agents: number;
  investments: number;
  createdAt: string;
}
export interface PublicUserDetail {
  id: string;
  username: string;
  walletAddress: string | null;
  balance: number;
  createdAt: string;
  agents: Agent[];
  transactions: Tx[];
  investments: { id: string; amount: number; agent: Agent }[];
  summary: { profit: number; volume: number; deposited: number; withdrawn: number; wins: number; losses: number };
  series: { t: string; value: number }[];
}
