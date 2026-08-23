# Production API image for Railway (pnpm monorepo).
FROM node:22-bookworm-slim

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

# Copy sources
COPY packages/shared packages/shared
COPY apps/api apps/api

# Build shared + generate Prisma client + compile API
RUN pnpm --filter @note-share/shared build \
  && pnpm --filter @note-share/api exec prisma generate \
  && pnpm --filter @note-share/api build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# db push keeps Aiven/Postgres schema in sync on boot (POC-friendly)
CMD ["sh", "-c", "pnpm --filter @note-share/api exec prisma db push && pnpm --filter @note-share/api start"]
