# Architecture & development

## Layout

```
src/
  routes/                 File-based routes (TanStack Router)
    app/…                 Dashboard (auth required)
    b.$slug.tsx           Public board & roadmap
    f.$slug.tsx           Shareable feedback form
    api/…                 HTTP endpoints (public API, CSV export, health)
  components/             UI building blocks (design system in styles.css)
  lib/                    Isomorphic code: constants, validation (zod), formatting
  server/
    db/                   Drizzle schema + client
    services/             Business logic. Pure functions over the database — tested directly
    functions/            createServerFn wrappers: auth + input validation → services
    http.ts               Cookies, sessions, client IP
    extensions.ts         Hooks for building on top (see extending.md)
  start.ts                Global middleware: CSRF, security headers, error masking
public/widget.js          The embeddable widget (vanilla JS, no build step)
drizzle/                  SQL migrations
scripts/                  migrate + seed
tests/                    Vitest suites (real Postgres)
```

**Rule of thumb:** routes call server functions; server functions check *who*
(auth/role/project access) and validate *what* (zod), then call services;
services do the work and are unit-tested against a real database.

## Data model

- `workspaces` ← `workspace_members` → `users` (roles: owner/admin/member)
- `projects` belong to a workspace; each has a public key, slug, widget settings,
  allowed origins and an optional webhook
- `feedback` belongs to a project; per-project `number` sequence, status, type,
  tags (`text[]`), public flag/reply, vote count and a generated `tsvector` for search
- `notes` (internal comments), `votes` (anonymous, hashed voter id)
- `sessions` (SHA-256 of the cookie token), `invites` (SHA-256 of the token)
- `rate_limits` — fixed-window counters in Postgres, so limits hold on serverless

## Tests

Tests hit a real Postgres database — no mocks.

```bash
createdb hootbox_test
echo 'TEST_DATABASE_URL=postgres://you@127.0.0.1:5432/hootbox_test' >> .env
pnpm test
```

Migrations run automatically before the suite; every test starts from empty
tables. The suite refuses to run against a database whose name doesn't contain
`test`.

## Changing the schema

1. Edit `src/server/db/schema.ts`
2. `pnpm db:generate` — writes a new SQL migration to `drizzle/`
3. Review the SQL, then `pnpm db:migrate`
4. Commit both

## Security notes

- Passwords: PBKDF2-SHA256 (600k iterations; 100k on Cloudflare Workers) via WebCrypto.
- Sessions: 256-bit random tokens in an `HttpOnly; SameSite=Lax` cookie (`Secure` on HTTPS);
  only a SHA-256 hash is stored. 30-day sliding expiry. Changing your password signs out other devices.
- CSRF: server functions only accept same-origin requests (`Sec-Fetch-Site` / `Origin`).
- Rate limits: login (per IP and per email), submissions, votes, invites.
- Spam: honeypot field, origin allowlist, size limits on every field.
- Output: React escaping everywhere; the widget only uses `textContent`; CSV export neutralises
  spreadsheet formulas; user-supplied links are restricted to http(s) and `rel="nofollow noopener"`.
- Headers: `X-Frame-Options: DENY` + `frame-ancestors 'none'` (except the embeddable form),
  `nosniff`, strict referrer policy.
- Unexpected server errors are logged and replaced with a generic message.
