# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# ---- build
FROM deps AS build
COPY . .
ENV NITRO_PRESET=node-server
RUN pnpm build

# ---- tiny migration runner (only drizzle-orm + postgres)
FROM node:22-alpine AS migrator
WORKDIR /migrator
COPY package.json /tmp/package.json
RUN npm init -y >/dev/null && npm install --omit=dev --no-audit --no-fund \
	$(node -p "const d=require('/tmp/package.json').dependencies;['drizzle-orm','postgres'].map(n=>n+'@'+d[n]).join(' ')")

# ---- runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY --from=build /app/.output ./.output
COPY --from=migrator /migrator/node_modules ./migrator/node_modules
COPY drizzle ./drizzle
COPY scripts/migrate.mjs ./migrator/migrate.mjs
ENV MIGRATIONS_DIR=/app/drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["sh", "-c", "node migrator/migrate.mjs && exec node .output/server/index.mjs"]
