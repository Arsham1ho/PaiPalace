import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Helpers for the BigInt micro-USDC money representation (1_000_000 = $1).
export const USD = 1_000_000n;
export const toUsd = (micro: bigint | number): number => Number(micro) / 1_000_000;
export const fromUsd = (usd: number): bigint => BigInt(Math.round(usd * 1_000_000));

// JSON.stringify can't serialize BigInt — register a safe replacer once.
export function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
  );
}
