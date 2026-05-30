# foundr-money

project-first agent-native budgeting for the multi-project micro-founder

Scaffolded by the [perea-ai plugin](https://github.com/dante-perea/claude-plugins/tree/main/plugins/perea-ai).

## Stack

Next.js 16 + React 19 + Tailwind v4 + TypeScript + Supabase + Clerk + Vercel.

## Develop

```bash
pnpm install
pnpm dev
# Opens http://localhost:3000
```

Env vars come from `.env.local` (populated by `vercel env pull` when you first ran `/perea-ai:start-project`).

## Deploy

Pushes to `main` deploy to production: `https://foundr-money.vercel.app`.
Pushes to any other branch deploy to a preview URL: `https://foundr-money-git-<branch>-<team>.vercel.app`.

## Migrations

New migrations go in `supabase/migrations/<timestamp>_<name>.sql`. Apply locally via Supabase MCP (`apply_migration`), then commit. On push-to-main, `.github/workflows/supabase-migrate.yml` re-applies any migrations not yet in the project's Supabase.

## License

MIT
