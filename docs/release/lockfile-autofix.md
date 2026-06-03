# Lockfile Autofix Bot

## What it does

When a PR modifies `package.json`, `pnpm-lock.yaml`, or `.npmrc`, two workflows run:

1. **Lockfile Guard** (read-only) checks if `pnpm-lock.yaml` is in sync with `package.json`.
2. **Lockfile Autofix Bot** (write, conditional) automatically regenerates and pushes a fix commit when drift is detected on same-repo PRs.

## Security model

- **Same-repo PRs**: Bot regenerates lockfile and pushes a commit signed as `orqenix-autofix[bot]`. Diff is restricted to `pnpm-lock.yaml` only; any other file modification aborts the autofix.
- **Fork PRs**: Bot does NOT push by default. Instead, it comments instructions for the contributor to fix locally. Maintainers can opt-in by setting repo variable `ALLOW_FORK_AUTOFIX=true` (not recommended without manual diff review).
- **Race protection**: Bot verifies the PR head SHA matches the SHA that triggered the guard. If the PR was updated mid-flight, autofix aborts cleanly.
- **Script integrity**: Bot runs `sync-lockfile.sh` with `NPM_CONFIG_IGNORE_SCRIPTS=true`, preventing any package install scripts from executing during regeneration.
- **Allowlist enforcement**: After sync, `verify-only-built-deps.mjs` confirms `pnpm.onlyBuiltDependencies` is unchanged from the canonical list (`better-sqlite3`, `esbuild`, `@swc/core`).

## When autofix will NOT run

- PR is from a fork and `ALLOW_FORK_AUTOFIX` is not enabled
- PR head SHA moved during the guard-to-autofix handoff
- Sync would modify files other than `pnpm-lock.yaml`
- `packageManager` field is missing or `pnpm.onlyBuiltDependencies` drifted

In all of these cases, the bot posts a comment explaining what happened and how to fix manually.

## Manual fix (fallback)

```bash
pnpm run lockfile:sync
git add pnpm-lock.yaml
git commit -m "chore: sync pnpm-lock.yaml"
git push
```

## Disabling the bot

To disable autofix entirely, delete `.github/workflows/lockfile-autofix.yml`. `lockfile-guard.yml` will still block bad PRs from merging.
