# Contributing

Thanks for helping make Hootbox better! 🦉

1. Fork & clone, then follow **Local development** in the [README](README.md).
2. Create a branch, make your change, and add tests for business logic in `tests/`
   (they run against a real Postgres database — please don't mock the DB).
3. Make sure everything passes:

   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   ```

4. Open a pull request describing *what* and *why*.

Guidelines:

- Keep it simple. Hootbox should stay easy to self-host and easy to understand.
- Business logic goes in `src/server/services`, not in routes or components.
- Validate all input with zod schemas in `src/lib/validation.ts`.
- Schema changes need a migration (`pnpm db:generate`).
