// Non-custodial Solana wallet integration (Phantom) — USDC on mainnet.
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

function getProvider(): any {
  const w = window as any;
  const p = w.phantom?.solana ?? w.solana;
  if (!p?.isPhantom) return null;
  return p;
}

export function hasPhantom(): boolean {
  return !!getProvider();
}

export async function connectPhantom(): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("Phantom wallet not found. Install it from phantom.app.");
  const res = await provider.connect();
  return res.publicKey.toString();
}

/** Build, sign (via Phantom) and send a USDC transfer to the treasury. Returns the tx signature. */
export async function depositUsdc(amountUsd: number): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("Phantom wallet not found.");
  if (!hasTreasury) throw new Error("Treasury address not configured.");
  const owner = new PublicKey(provider.publicKey.toString());
  const treasury = new PublicKey(TREASURY_STR);

  const fromAta = await getAssociatedTokenAddress(USDC, owner);
  const toAta = await getAssociatedTokenAddress(USDC, treasury);
  const amountRaw = BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS));

  const tx = new Transaction().add(
    // create the treasury's USDC token account if it doesn't exist yet (idempotent)
    createAssociatedTokenAccountIdempotentInstruction(owner, toAta, treasury, USDC),
    createTransferInstruction(fromAta, toAta, owner, amountRaw),
  );
  tx.feePayer = owner;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const { signature } = await provider.signAndSendTransaction(tx);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}
