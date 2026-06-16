import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  // Solana (mainnet)
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",
  USDC_MINT: process.env.USDC_MINT ?? "",
  TREASURY_ADDRESS: process.env.TREASURY_ADDRESS ?? "",
  TREASURY_SECRET: process.env.TREASURY_SECRET ?? "",
  // key used to encrypt per-user deposit-wallet secrets at rest
  WALLET_ENCRYPTION_KEY: process.env.WALLET_ENCRYPTION_KEY ?? "dev-insecure-wallet-key-change-me",
  // The first user with this email (or the first user overall) becomes admin
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "",
};

export const USE_CLAUDE = env.ANTHROPIC_API_KEY.length > 0;
