import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from "@solana/spl-token";
import { Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import crypto from "node:crypto";
import { env } from "./env.js";

// Mainnet USDC mint by default.
export const USDC_MINT = new PublicKey(
  env.USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
const USDC_DECIMALS = 6;

export const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");

export const TREASURY_ADDRESS = env.TREASURY_ADDRESS;

function treasuryKeypair(): Keypair {
  if (!env.TREASURY_SECRET) throw new Error("TREASURY_SECRET not configured");
  return Keypair.fromSecretKey(bs58.decode(env.TREASURY_SECRET));
}

export function isValidSolanaAddress(addr: string): boolean {
  try {
    // base58, on the ed25519 curve check is optional; PublicKey ctor validates length/charset
    new PublicKey(addr);
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
  } catch {
    return false;
  }
}

/**
 * Verify an on-chain USDC deposit by transaction signature.
 * Confirms the treasury's USDC balance increased and the payer address is in
 * the transaction. Returns the credited USDC amount (in USD) or null.
 */
export async function verifyUsdcDeposit(
  signature: string,
  fromAddress: string,
): Promise<{ amountUsd: number } | null> {
  if (!TREASURY_ADDRESS) throw new Error("TREASURY_ADDRESS not configured");
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx || tx.meta?.err) return null;

  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];

  const treasuryPost = post.find(
    (b) => b.owner === TREASURY_ADDRESS && b.mint === USDC_MINT.toBase58(),
  );
  if (!treasuryPost) return null;
  const treasuryPre = pre.find(
    (b) => b.accountIndex === treasuryPost.accountIndex,
  );
  const before = Number(treasuryPre?.uiTokenAmount.amount ?? "0");
  const after = Number(treasuryPost.uiTokenAmount.amount ?? "0");
  const deltaRaw = after - before;
  if (deltaRaw <= 0) return null;

  // ensure the claimed sender actually participated in this transaction
  const keys = tx.transaction.message.accountKeys.map((k) =>
    typeof k === "string" ? k : k.pubkey.toBase58(),
  );
  if (!keys.includes(fromAddress)) return null;

  return { amountUsd: deltaRaw / 10 ** USDC_DECIMALS };
}

/** Send USDC from the treasury to a destination address. Returns the signature. */
export async function sendUsdcFromTreasury(
  toAddress: string,
  amountUsd: number,
): Promise<string> {
  const treasury = treasuryKeypair();
  const dest = new PublicKey(toAddress);
  const fromAta = await getAssociatedTokenAddress(USDC_MINT, treasury.publicKey);
  const toAtaAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    USDC_MINT,
    dest,
  );
  const amountRaw = BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS));
  const ix = createTransferInstruction(
    fromAta,
    toAtaAccount.address,
    treasury.publicKey,
    amountRaw,
  );
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(connection, tx, [treasury]);
}

export const SOLANA_CONFIGURED = !!(env.SOLANA_RPC_URL && env.TREASURY_ADDRESS);
export const WITHDRAWALS_ENABLED = !!env.TREASURY_SECRET;

// ── per-user deposit wallets ──────────────────────────────────────────────
const ENC_KEY = crypto.createHash("sha256").update(env.WALLET_ENCRYPTION_KEY).digest();

function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(blob: string): string {
  const [iv, tag, data] = blob.split(":").map((s) => Buffer.from(s, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Generate a fresh custodial deposit wallet (address + encrypted secret). */
export function generateDepositWallet(): { address: string; encryptedSecret: string } {
  const kp = Keypair.generate();
  return { address: kp.publicKey.toBase58(), encryptedSecret: encryptSecret(bs58.encode(kp.secretKey)) };
}

/** Read the USDC balance (in USD) held by an address. */
export async function getUsdcBalance(address: string): Promise<number> {
  try {
    const accs = await connection.getParsedTokenAccountsByOwner(new PublicKey(address), { mint: USDC_MINT });
    let total = 0;
    for (const { account } of accs.value) {
      total += account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0;
    }
    return total;
  } catch {
    return 0;
  }
}
