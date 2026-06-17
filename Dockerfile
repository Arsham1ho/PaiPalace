# PaiPalace — single image that builds the client and serves it from the
# Express + Socket.IO server (one Railway service). Postgres is a separate
# managed service; DATABASE_URL is injected at runtime.
FROM node:20-slim

# OpenSSL is required by Prisma's query engine on debian-slim.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

# Install workspace deps first (layer cached until a manifest changes).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN pnpm install --frozen-lockfile

# Source.
COPY . .

# Build the client (static), generate the Prisma client, build the server.
RUN pnpm --filter @paipalace/client build \
 && pnpm --filter @paipalace/server exec prisma generate \
 && pnpm --filter @paipalace/server build

ENV NODE_ENV=production
EXPOSE 4000

# Apply pending migrations, then start. The server serves ../client/dist.
CMD ["sh", "-c", "pnpm --filter @paipalace/server exec prisma migrate deploy && node server/dist/index.js"]
