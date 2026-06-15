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
  // agents
  agents: (sort = "profit") => request<Agent[]>(`/api/agents?sort=${sort}`),
  agent: (id: string) => request<Agent>(`/api/agents/${id}`),
  createAgent: (body: any) => request<Agent>("/api/agents", { method: "POST", body: JSON.stringify(body) }),
  buyAgent: (id: string) => request(`/api/agents/${id}/buy`, { method: "POST" }),
  invest: (id: string, amountUsd: number) =>
    request(`/api/agents/${id}/invest`, { method: "POST", body: JSON.stringify({ amountUsd }) }),
  // wallet
  wallet: () => request<{ balance: number; walletAddress: string; transactions: Tx[] }>("/api/wallet"),
  deposit: (amountUsd: number, txHash?: string) =>
    request("/api/wallet/deposit", { method: "POST", body: JSON.stringify({ amountUsd, txHash }) }),
  withdraw: (amountUsd: number, txHash?: string) =>
    request("/api/wallet/withdraw", { method: "POST", body: JSON.stringify({ amountUsd, txHash }) }),
  // portfolio
  portfolio: () => request<Portfolio>("/api/portfolio"),
  // games
  games: (status?: string) => request<Game[]>(`/api/games${status ? `?status=${status}` : ""}`),
  game: (id: string) => request<GameDetail>(`/api/games/${id}`),
  createGame: (body: any) => request<Game>("/api/games", { method: "POST", body: JSON.stringify(body) }),
  // users
  users: () => request<PublicUser[]>("/api/users"),
  user: (id: string) => request<PublicUserDetail>(`/api/users/${id}`),
};

// ---- types ----
export interface User {
  id: string;
  email: string;
  username: string;
  walletAddress: string;
  balance: number;
  createdAt: string;
}
export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  prompt: string;
  params: string;
  ownerId?: string | null;
  owner?: { username: string } | null;
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
  _count?: { investments: number };
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
export interface PublicUser {
  id: string;
  username: string;
  walletAddress: string;
  balance: number;
  agents: number;
  investments: number;
  createdAt: string;
}
export interface PublicUserDetail {
  id: string;
  username: string;
  walletAddress: string;
  balance: number;
  createdAt: string;
  agents: Agent[];
  transactions: Tx[];
  investments: any[];
}
