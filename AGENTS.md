# Foundr · foundr-money

> **Canonical agent rules:** [`.claude/rules.md`](./.claude/rules.md) — read before doing meaningful work.

## What this is

project-first agent-native budgeting for the multi-project micro-founder

- Production: `https://foundr.money/`
- Lab wildcard: `*.lab.foundr.money`
- Repo: `dante-perea/foundr-money`

## Branch + lab convention

Cut a branch named `experiment/<feature-slug>` (kebab-case, **≤50 chars**) from `main`. Push it.

- Vercel auto-builds a preview
- `.github/workflows/lab-alias.yml` aliases the preview to `https://<feature-slug>.lab.foundr.money/` via `amondnet/vercel-action`
- Sibling worktree at `/home/dante/projects/foundr-money/<feature-slug>/` is where the agent lives for the lifetime of the feature

Merge the PR → `main` auto-deploys to `https://foundr.money/`. Vercel's Deployment Retention Policy (14 days) prunes old preview deployments. `.github/workflows/lab-gc.yml` (cron 6h) prunes dangling aliases.

## Checkout layout — bare-repo colocated

```
/home/dante/projects/foundr-money/
├── .bare/                              ← bare clone (single source of truth)
├── .git                                ← file: "gitdir: ./.bare"
├── main/                               ← worktree on main
└── <feature-slug>/                     ← per-feature sibling worktrees
```

`/perea-ai:start-feature` creates each sibling worktree.

## Skill chain

```
/perea-ai:start-feature <description>   ← cuts experiment/<slug> branch + sibling worktree
/perea-ai:research <description>        ← optional, Exa-backed deep research
/perea-ai:plan <description>            ← spec + plan in docs/superpowers/
/perea-ai:implement                     ← subagent-driven implementation
/perea-ai:promote                       ← PR + CI + merge + verify prod
```

One-shot: `/perea-ai:autonomous <description>` chains all five with checkpoints.

## Stack

See `.claude-plugin/project-meta.json` `stack` block. Per-product overlay skills (B2 lab prefix, Supabase branching, Clerk authorizedParties, Stripe webhook) read from there.

## Communication preference

When reporting completed changes, use a concise `What changed:` section followed by `How to test:`. See `.claude/rules.md` for the canonical format.
