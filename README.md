<div align="center">

# 🦉 Hootbox

**Friendly, self-hostable feedback collection.**
A widget for your site, a public board with voting and a roadmap, and a cosy inbox for your team.

[Features](#features) · [Quick start](#quick-start) · [Deploy](docs/self-hosting.md) · [Widget](docs/widget.md) · [API](docs/api.md) · [Contributing](CONTRIBUTING.md)

</div>

---

## Features

- **💬 Embeddable widget**: one `<script>` tag adds a playful feedback button to any website. Feedback type, mood rating, optional email, page URL and browser are captured automatically. Custom triggers, user identification and metadata via a tiny JS API.
- **🗳️ Public board & roadmap**: let users post ideas, upvote, and see what's *planned*, *in progress* and *done*. Reply publicly to posts.
- **🔗 Shareable form**: a standalone feedback page for emails, QR codes and support replies. Embeddable via iframe.
- **📥 Inbox**: filter by status, type and tag, full-text search, bulk triage, tags, internal team notes, one-click "reply by email".
- **📊 Insights**: volume over time, breakdown by type & status, average mood, top tags and most-voted ideas.
- **🔔 Notifications**: Slack and Discord webhooks out of the box, or signed JSON webhooks for anything else.
- **🛠️ REST API**: submit feedback from your backend, mobile app or Zapier.
- **👥 Teams**: invite teammates with single-use links; owner / admin / member roles.
- **📦 CSV export**: your data, whenever you want it.
- **🔒 Secure by default**: hashed sessions & passwords, CSRF protection, rate limiting, spam honeypot, origin allowlist, security headers.
- **🚀 Deploy anywhere**: Docker, any Node host/VPS, Vercel, Netlify or Cloudflare Workers. Just needs Postgres.

## Quick start

### Docker (recommended for self-hosting)

```bash
git clone https://github.com/dtsakadze/hootbox.git && cd hootbox
docker compose up -d
```

Open <http://localhost:3000> and create your owner account. That's it.
For production setups (custom domain, Vercel, Cloudflare, managed Postgres) see **[docs/self-hosting.md](docs/self-hosting.md)**.

### Local development

Requirements: Node.js ≥ 20.19, pnpm, PostgreSQL ≥ 14.

```bash
pnpm install
cp .env.example .env            # point DATABASE_URL at your Postgres
pnpm db:migrate                 # create tables
pnpm db:seed                    # optional: demo data
pnpm dev                        # http://localhost:3000
```

The seed creates two accounts (password `hootbox123`):

| Email              | Role   |
| ------------------ | ------ |
| `demo@hootbox.dev` | Owner  |
| `sam@hootbox.dev`  | Member |

…plus three projects with ~100 pieces of feedback, votes, notes and replies. Public board: <http://localhost:3000/b/pixel-planner>. Run `pnpm db:seed --reset` to start over.

## Collecting feedback

```html
<script src="https://feedback.example.com/widget.js" data-key="pk_your_project_key" defer></script>
```

Find your snippet under **Share & install** in each project. See **[docs/widget.md](docs/widget.md)** for the JS API and **[docs/api.md](docs/api.md)** for REST & webhooks.

## Tech stack

[TanStack Start](https://tanstack.com/start) (React 19, SSR) · [Nitro](https://nitro.build) · PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) · Tailwind CSS v4 · Zod · Vitest

## Scripts

| Command             | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `pnpm dev`          | Dev server with hot reload                             |
| `pnpm build`        | Production build (`.output/`)                          |
| `pnpm start`        | Run the production build                               |
| `pnpm test`         | Unit/integration tests against a real test database    |
| `pnpm typecheck`    | TypeScript                                             |
| `pnpm lint`         | Biome lint + format check (`pnpm format` to fix)       |
| `pnpm db:generate`  | Create a migration after editing the schema            |
| `pnpm db:migrate`   | Apply migrations                                       |
| `pnpm db:seed`      | Load demo data                                         |

## Documentation

- [Self-hosting & deployment](docs/self-hosting.md)
- [Widget](docs/widget.md)
- [REST API & webhooks](docs/api.md)
- [Architecture & development](docs/development.md)
- [Extending Hootbox / hosted edition](docs/extending.md)
- [Security](SECURITY.md)

## License

[MIT](LICENSE): free for personal and commercial use.
