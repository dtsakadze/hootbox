# Self-hosting & deployment

Hootbox is a single web app plus a PostgreSQL database (v14+). It builds with
[Nitro](https://nitro.build), so the same code runs on a VPS, in Docker, or on
serverless platforms.

## Environment variables

| Variable                 | Required | Description |
| ------------------------ | -------- | ----------- |
| `DATABASE_URL`           | ✅       | Postgres connection string. |
| `APP_URL`                | recommended | Public URL, e.g. `https://feedback.example.com`. Used in widget snippets and invite links (defaults to the request origin), and **required for "open in Hootbox" links in webhook notifications** — those are never built from request headers, which anonymous submitters control. |
| `DATABASE_POOL_MAX`      |          | Connections per server instance (default `10`). Use `1`–`3` on serverless. |
| `DATABASE_PREPARE`       |          | Set `false` behind transaction-mode poolers (PgBouncer, Supabase pooler, Neon pooled URL, Cloudflare Hyperdrive). |
| `TRUST_PROXY`            |          | Defaults to `true` (client IP taken from `X-Forwarded-For`). Set `false` if Hootbox faces the internet **without** a reverse proxy, so the header can't be spoofed to dodge rate limits. |
| `ALLOW_PRIVATE_WEBHOOKS` |          | `true` lets webhooks target private/internal addresses (blocked by default). |
| `PORT` / `HOST`          |          | Node server listen address (default `3000` / all interfaces). |

Migrations are plain SQL in [`drizzle/`](../drizzle) and are safe to run on
every deploy: `pnpm db:migrate` (or `node scripts/migrate.mjs`).

After the first deploy, open the app and create the **owner** account on the
setup screen. Afterwards, sign-ups are invite-only (Team → Invite).

---

## Docker / Docker Compose

```bash
docker compose up -d                     # app + Postgres on http://localhost:3000
POSTGRES_PASSWORD=change-me docker compose up -d
```

The image runs migrations automatically on start and exposes a health check at
`/api/health`. To use an external database, run just the image:

```bash
docker build -t hootbox .
docker run -p 3000:3000 -e DATABASE_URL=postgres://… -e APP_URL=https://feedback.example.com hootbox
```

Put a TLS-terminating reverse proxy (Caddy, Traefik, nginx) in front for HTTPS —
session cookies are marked `Secure` automatically when served over HTTPS.

Example `Caddyfile`:

```
feedback.example.com {
  reverse_proxy localhost:3000
}
```

## Plain Node.js (VPS)

```bash
pnpm install --frozen-lockfile
pnpm build
DATABASE_URL=… pnpm db:migrate
DATABASE_URL=… APP_URL=… pnpm start      # node .output/server/index.mjs
```

Use systemd, pm2, or similar to keep it running.

## Vercel

1. Import the repository. Vercel detects Nitro automatically.
2. Add `DATABASE_URL` (Neon, Supabase, Vercel Postgres…) and `DATABASE_POOL_MAX=1`.
   With a pooled/transaction-mode URL, also set `DATABASE_PREPARE=false`.
3. Set the build command to `pnpm db:migrate && pnpm build` so migrations run on deploy.

## Netlify

Same as Vercel; Nitro auto-detects Netlify. Build command `pnpm db:migrate && pnpm build`.

## Cloudflare Workers

```bash
NITRO_PRESET=cloudflare_module pnpm build
```

- Enable the `nodejs_compat` compatibility flag (the Postgres driver needs it).
- Use [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) in front of your
  database and set `DATABASE_PREPARE=false`, `DATABASE_POOL_MAX=1`.
- Run migrations from your machine or CI: `DATABASE_URL=… pnpm db:migrate`.
- Password hashing automatically uses Workers' PBKDF2 limit (100k iterations);
  hashes stay valid if you move between runtimes.

> The Node and Docker targets are what the project is tested on. Vercel and
> Cloudflare builds compile in CI-style checks, but test with your own account
> before going live.

## Backups

All state lives in Postgres. Back it up like any database, e.g.

```bash
pg_dump "$DATABASE_URL" --format=custom --file hootbox-$(date +%F).dump
```

## Upgrading

Pull the new version, rebuild, run `pnpm db:migrate` (Docker does this for you).
