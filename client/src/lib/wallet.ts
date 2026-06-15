// Lightweight EVM wallet connect via the injected provider (MetaMask, etc.).
// No API key required. Mainnet-ready, defaults to a testnet via VITE_CHAIN_ID.
import { createWalletClient, custom, type WalletClient } from "viem";

const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 84532); // Base Sepolia testnet

export interface ConnectedWallet {
  address: string;
  chainId: number;
}

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && !!(window as any).ethereum;
}

export async function connectWallet(): Promise<ConnectedWallet> {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No EVM wallet found. Install MetaMask or a compatible wallet.");
  const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
  const chainIdHex: string = await eth.request({ method: "eth_chainId" });
  return { address: accounts[0], chainId: parseInt(chainIdHex, 16) };
}

export function getWalletClient(): WalletClient {
  const eth = (window as any).ethereum;
  return createWalletClient({ transport: custom(eth) });
}

export const TARGET_CHAIN_ID = CHAIN_ID;
export const IS_TESTNET = CHAIN_ID !== 1 && CHAIN_ID !== 8453 && CHAIN_ID !== 137;
