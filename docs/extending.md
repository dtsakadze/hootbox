# Extending Hootbox (and the hosted edition)

Hootbox is MIT-licensed and complete on its own. It's also designed so a
hosted/commercial edition (billing, plans, open sign-ups, multiple
organisations, a super-admin) can be built **on top** without forking.

## What's already in place

1. **Workspaces.** Every project belongs to a workspace and every user's access
   comes from `workspace_members`. The OSS edition runs one workspace per
   instance; a hosted edition can let users belong to many (`getMembership()`
   already accepts a `workspaceId`.
2. **Extension hooks** (`src/server/extensions.ts`):

   | Hook                    | Use it for |
   | ----------------------- | ---------- |
   | `allowOpenSignup`       | Self-serve sign-ups that create their own workspace |
   | `beforeProjectCreate`   | Plan limits on projects |
   | `beforeMemberJoin`      | Seat limits |
   | `beforeFeedbackCreate`  | Monthly feedback quotas |
   | `onFeedbackCreated`     | Usage metering, email notifications, analytics |

   Throwing an `AppError` from a `before*` hook blocks the action and shows the
   message to the user (e.g. "Upgrade to add more projects").
3. **Automatic loading of an `ee/` package.** If `ee/server/index.ts` exists, its
   default export is registered as extensions at build time. Without it, nothing
   changes:

   ```ts
   // ee/server/index.ts
   import { AppError } from "#/server/lib/errors";
   import type { Extensions } from "#/server/extensions";

   export default {
     allowOpenSignup: true,
     async beforeProjectCreate({ workspaceId }) {
       if (!(await planAllowsMoreProjects(workspaceId))) {
         throw new AppError("FORBIDDEN", "Upgrade your plan to add more projects.");
       }
     },
   } satisfies Partial<Extensions>;
   ```

## Recommended repository setup

Keep this repository public and MIT-licensed. Put commercial code in a
**separate private repository** mounted at `ee/` as a git submodule:

```bash
git submodule add git@github.com:you/hootbox-ee.git ee
```

- The public repo never contains proprietary code (and `ee/` is simply absent
  for self-hosters).
- The hosted build checks out submodules; everything else (CI, migrations,
  tests) stays shared.
- Upstream improvements flow into the hosted product with no merge conflicts,
  because the commercial code only touches the extension points.

If you'd rather publish the commercial code as *source-available*, the same
`ee/` folder can live in this repo with its own `ee/LICENSE` (the model used by
Cal.com, PostHog and others). The loading mechanism is identical.

## Adding hosted-only pages and tables

- **Tables:** keep them in `ee/server/db/schema.ts` with their own Drizzle
  migrations folder (`ee/drizzle`), referencing core tables by id. Run both
  migration sets on deploy.
- **Pages** (billing, admin): TanStack Router supports mounting additional route
  directories via [virtual file routes](https://tanstack.com/router/latest/docs/framework/react/routing/virtual-file-routes).
  Mount `ee/routes` under e.g. `/app/billing` and `/admin` in `vite.config.ts`
  when the folder exists.
- **Payments webhooks:** add server routes under `ee/routes/api/…` the same way.
