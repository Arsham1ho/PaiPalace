# Deploying PaiPalace (Railway + Postgres, mainnet)

PaiPalace ships as **one Railway service**: the Express + Socket.IO server
builds the React client and serves it from the same origin. A managed
**Postgres** stores all data. This guide takes you from repo → live URL.

> ⚠️ **Real-money launch.** This deploy targets Solana **mainnet** with real
> USDC. The treasury secret controls real funds. Read the [Security](#security)
> and [Compliance](#compliance) sections before taking deposits.

---

## 1. Prerequisites

- A [Railway](https://railway.app) account (Hobby plan is fine to start).
- This repo pushed to GitHub (already done).
- A funded Solana **treasury** keypair (receives deposits, sends withdrawals).
- A production Solana RPC (Helius / QuickNode) — the public RPC is rate-limited.
- Optional: an `XAI_API_KEY` (Grok) or `ANTHROPIC_API_KEY` (Claude) for live AI.

Generate secrets locally:

```bash
# JWT signing secret
openssl rand -hex 48
# Wallet-encryption key (encrypts per-user deposit secrets at rest)
openssl rand -hex 32
# A fresh treasury keypair (address + base58 secret)
node -e "const {Keypair}=require('@solana/web3.js');const b=require('bs58');const k=Keypair.generate();console.log('addr',k.publicKey.toBase58());console.log('secret',b.default.encode(k.secretKey))"
```

---

## 2. Create the Railway project

1. **New Project → Deploy from GitHub repo →** select this repo.
2. Railway detects the root `Dockerfile` and `railway.json` (healthcheck `/health`).
3. **Add a database:** in the project, **New → Database → PostgreSQL**.
4. In the **app service → Variables**, add a reference to the DB:
   `DATABASE_URL = ${{Postgres.DATABASE_URL}}` (Railway autocompletes this).

The container runs `prisma migrate deploy` on every boot, so the schema is
created/updated automatically from `server/prisma/migrations`.

---

## 3. Environment variables (app service)

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference, set above) |
| `JWT_SECRET` | output of `openssl rand -hex 48` |
| `WALLET_ENCRYPTION_KEY` | output of `openssl rand -hex 32` |
| `TREASURY_ADDRESS` | treasury public address |
| `TREASURY_SECRET` | treasury base58 secret (**server-only, never the client**) |
| `SOLANA_RPC_URL` | your mainnet RPC (Helius/QuickNode) |
| `USDC_MINT` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (mainnet USDC) |
| `ADMIN_EMAIL` | the email that becomes platform admin on first signup |
| `CLIENT_ORIGIN` | leave **unset** (client is served same-origin) |
| `XAI_API_KEY` / `XAI_MODEL` | optional — Grok live decisions (`grok-4`) |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | optional — Claude fallback |
| `PORT` | leave unset — Railway injects it |

> The client is built **inside** the image and served same-origin, so you do
> **not** need `VITE_API_URL` / `VITE_*` for this single-service setup. If you
> later split the frontend to its own host, set `VITE_API_URL` at build time and
> `CLIENT_ORIGIN` on the server.

---

## 4. Deploy & domain

1. Railway builds the Dockerfile and starts the service. Watch **Deploy logs**
   for `🎰 PaiPalace API` and a successful `prisma migrate deploy`.
2. **Settings → Networking → Generate Domain** to get a public HTTPS URL
   (WebSockets work over it automatically).
3. Open the URL — the app loads, `/health` returns `{ ok: true }`.
4. Sign up with `ADMIN_EMAIL` to get the admin account, then seed/house agents
   exist automatically via signups (or run the seed once — see below).

### Seeding house agents (optional, once)

The "Add AI opponent" feature needs house agents (`ownerId = null`). To seed:

```bash
# from a one-off Railway shell or locally against the prod DATABASE_URL
pnpm --filter @paipalace/server exec tsx prisma/seed.ts
```

---

## 5. Local development (now Postgres)

The Prisma provider is Postgres, so local dev uses Postgres too:

```bash
docker compose up -d db            # starts Postgres on :5432
# server/.env already points DATABASE_URL at it
pnpm --filter @paipalace/server exec prisma migrate deploy
pnpm seed                          # optional: house agents + demo data
pnpm dev                           # client :5173, server :4000
```

---

## Security

- **Treasury secret** is the master key to real funds. Keep it only in Railway
  variables (never commit, never expose to the client). Consider a hot wallet
  with a capped balance and a cold treasury for the rest.
- Rotate `JWT_SECRET` / `WALLET_ENCRYPTION_KEY` away from any dev values.
- Put a real RPC behind `SOLANA_RPC_URL`; the public endpoint will throttle.
- Review withdrawal authorization and rate-limit deposit/withdraw endpoints
  before opening to the public.

## Compliance

Real-money gambling is regulated. Operating live generally requires the
appropriate **licensing** and **KYC/AML** in each jurisdiction you serve, plus
age verification (18/21+). This is your responsibility before accepting real
deposits — the app does not implement KYC.
