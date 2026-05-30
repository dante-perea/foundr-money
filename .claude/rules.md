# foundr-money — Agent operational rules

Canonical operational rules for any agent working on `foundr-money`. Read before cutting an experiment branch, editing outside `src/`, running anything against production, or handling secrets.

## 1. Worktrees are the only checkout

`/perea-ai:start-feature` creates a sibling worktree at `/home/dante/projects/foundr-money/<slug>/`. All work happens INSIDE the worktree. Never `cd` to the bare-repo root (`/home/dante/projects/foundr-money/`); never edit `.bare/` directly. Sibling worktrees are equal — `main/` is just one of them.

When done with a feature, `/perea-ai:promote` will offer to clean up the worktree post-merge. Accept it unless you have uncommitted local notes.

## 2. Worktree creation is serialized

`/perea-ai:start-feature` uses `flock ~/.worktree-create.lock` to serialize concurrent `git worktree add` calls — known git-upstream race on `.git/config.lock` at ≥3 parallel spawns. If you bypass the skill and run `git worktree add` directly, use the same flock pattern.

## 3. Secrets

- `.env.local` is gitignored. The repo ships `.worktreeinclude` so it (and `.env.development`) propagate into each new worktree when created via `claude --worktree`.
- Never paste a real production access token into chat. Use the project's local mint script (`scripts/mint-token.mjs` if shipped) to mint smoke-test tokens.
- The Vercel API token (`VERCEL_TOKEN`) lives in `~/.env.local` and in the GitHub repo secret `VERCEL_TOKEN`. Don't echo it.

## 4. node_modules across worktrees

`.npmrc` declares `enableGlobalVirtualStore=true` so `pnpm install` in a new worktree reuses the global content-addressable store. Don't `rm -rf node_modules` unless you know what you're doing — it's cheap and harmless to keep.

## 5. Dev-server port per worktree

Two worktrees can't share the same dev-server port. The convention: `package.json`'s `dev` script should set `PORT=${PORT:-$((5173 + RANDOM % 100))}` so each worktree gets a random unique port. Set `PORT` explicitly in env if you need a stable port for browser bookmarks. If the project's `dev` script doesn't yet implement this, add it the first time you spawn a sibling worktree.

## 6. Anti-patterns (project-specific)

(Each retrofit / start-project run appends product-specific anti-patterns here.)

## 7. Reporting completed changes

```
What changed: <one-paragraph summary>
How to test: <numbered steps or a URL + curl commands>
Migration needed: <yes/no + details>
```

## 8. Verification before claiming done

Before saying "shipped" or "fixed":
- Run the actual command (curl the URL, run the test, observe the output)
- For UI: open in a browser; don't claim visual correctness without seeing it
- For data changes: verify the data shape via a query, not just the API response

## 9. References

- Spec/plan dossiers: `docs/superpowers/specs/`, `docs/superpowers/plans/`
- Machine-readable project info: `.claude-plugin/project-meta.json`
- Per-product overlays: see the `stack` block in `project-meta.json`
