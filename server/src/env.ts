import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
};

export const USE_CLAUDE = env.ANTHROPIC_API_KEY.length > 0;
