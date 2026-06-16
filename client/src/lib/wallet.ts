// Solana wallet integration — supports multiple injected wallets (Phantom,
// Solflare, Backpack) for connecting + signing USDC deposits to the treasury.
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
} from "@solana/spl-token";

const RPC = import.meta.env.VITE_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const USDC = new PublicKey(import.meta.env.VITE_USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TREASURY_STR = import.meta.env.VITE_TREASURY_ADDRESS ?? "";
const USDC_DECIMALS = 6;

export const connection = new Connection(RPC, "confirmed");
export const hasTreasury = TREASURY_STR.length > 0;

export type WalletKey = "phantom" | "solflare" | "backpack";
export interface WalletOption { key: WalletKey; name: string; installed: boolean; url: string }

function providerFor(key: WalletKey): any {
  const w = window as any;
  if (key === "phantom") return w.phantom?.solana?.isPhantom ? w.phantom.solana : (w.solana?.isPhantom ? w.solana : null);
  if (key === "solflare") return w.solflare?.isSolflare ? w.solflare : null;
  if (key === "backpack") return w.backpack?.isBackpack ? w.backpack : (w.xnft?.solana ?? null);
  return null;
}

export function walletOptions(): WalletOption[] {
  return [
    { key: "phantom", name: "Phantom", installed: !!providerFor("phantom"), url: "https://phantom.app/" },
    { key: "solflare", name: "Solflare", installed: !!providerFor("solflare"), url: "https://solflare.com/" },
    { key: "backpack", name: "Backpack", installed: !!providerFor("backpack"), url: "https://backpack.app/" },
  ];
}

export async function connectWallet(key: WalletKey): Promise<string> {
  const provider = providerFor(key);
  if (!provider) throw new Error(`${key} wallet not found.`);
  const res = await provider.connect();
  return (res?.publicKey ?? provider.publicKey).toString();
}

/** Build, sign (via the chosen wallet) and send a USDC transfer to the treasury. */
export async function depositUsdc(key: WalletKey, amountUsd: number): Promise<string> {
  const provider = providerFor(key);
  if (!provider) throw new Error("Wallet not found.");
  if (!hasTreasury) throw new Error("Treasury address not configured.");
  const owner = new PublicKey((provider.publicKey ?? (await provider.connect()).publicKey).toString());
  const treasury = new PublicKey(TREASURY_STR);

  const fromAta = await getAssociatedTokenAddress(USDC, owner);
  const toAta = await getAssociatedTokenAddress(USDC, treasury);
  const amountRaw = BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS));

  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(owner, toAta, treasury, USDC),
    createTransferInstruction(fromAta, toAta, owner, amountRaw),
  );
  tx.feePayer = owner;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const { signature } = await provider.signAndSendTransaction(tx);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}
