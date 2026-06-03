# Agent Task: Fix pnpm Lockfile Drift in Orqenix-Pro Monorepo

## Context
You are a release-validator agent for the Orqenix-Pro monorepo (7 Pro packages). The CI is failing with `ERR_PNPM_OUTDATED_LOCKFILE` because `pnpm-lock.yaml` is not in sync with the root `package.json`.

## Constraints (CRITICAL, do not violate)
1. NEVER change CI to use `--no-frozen-lockfile`. Keep `--frozen-lockfile` in CI.
2. NEVER bump versions of unrelated packages. Only the deps that are out of sync should appear in the lockfile diff.
3. MUST preserve `.npmrc` settings: `ignore-scripts=true`, and `pnpm.onlyBuiltDependencies` allowlist (`better-sqlite3`, `esbuild`, `@swc/core`).
4. MUST use the exact `packageManager` version pinned in root `package.json`.
5. MUST NOT modify any package source files. Only `pnpm-lock.yaml` (and optionally root `package.json` if a version pin is missing) may be touched.

## Goal
Regenerate `pnpm-lock.yaml` so it matches root `package.json`, verify integrity, and open a PR with a minimal, clean diff.

## Step-by-Step Procedure

### Step 1: Detect Drift
Run:
```bash
node scripts/release/check-lockfile-drift.mjs
```

If output reports `DRIFT_DETECTED`, capture the list of mismatched specifiers and proceed. If `IN_SYNC`, stop and report success.

### Step 2: Read Required Tools

```bash
PNPM_VERSION=$(node -p "require('./package.json').packageManager.split('@')[1]")
corepack enable
corepack prepare pnpm@${PNPM_VERSION} --activate
pnpm --version
```

Verify the printed version matches `PNPM_VERSION`. If mismatch, abort and report.

### Step 3: Regenerate Lockfile (Lockfile-Only)

```bash
pnpm install --lockfile-only
```

Do NOT install node_modules yet.

### Step 4: Validate Lockfile

Run all four checks. If any fails, abort and report.

```bash
# 4a. Frozen-lockfile must now pass
pnpm install --frozen-lockfile --lockfile-only

# 4b. Workspace count must remain
WORKSPACE_COUNT=$(pnpm -r exec node -e "process.stdout.write('1')" | wc -c)
test "$WORKSPACE_COUNT" -eq 7

# 4c. Allowlist preserved
node scripts/release/verify-only-built-deps.mjs

# 4d. Diff must only touch declared deps
node scripts/release/verify-lockfile-diff-scope.mjs
```

### Step 5: Open PR

```bash
BRANCH="chore/sync-pnpm-lockfile-$(date +%Y%m%d-%H%M%S)"
git checkout -b "$BRANCH"
git add pnpm-lock.yaml
git commit -m "chore: sync pnpm-lock.yaml with root package.json

Resolves ERR_PNPM_OUTDATED_LOCKFILE in CI.
Scope of change: pnpm-lock.yaml only.
onlyBuiltDependencies allowlist: preserved.
"
git push origin "$BRANCH"
gh pr create \
  --title "chore: sync pnpm-lock.yaml (fix ERR_PNPM_OUTDATED_LOCKFILE)" \
  --body-file .orqenix-pro/prompts/lockfile-pr-body.md \
  --label "chore,ci,automated"
```

### Step 6: Report

Output a JSON report to stdout:

```json
{
  "status": "success | failed | no_drift",
  "drifted_specifiers": [],
  "pr_url": "https://github.com/milosaysyolo/Orqenix-Pro/pull/XXX",
  "allowlist_preserved": true,
  "frozen_lockfile_passes": true
}
```

## Denied Actions

* DO NOT run `pnpm install` without `--lockfile-only` until after Step 4 validates the lockfile.
* DO NOT modify `.npmrc`.
* DO NOT modify any workspace `package.json` files.
* DO NOT bypass CI by adding `[skip ci]` or similar.
* DO NOT delete and regenerate `pnpm-lock.yaml` from scratch.

## Failure Handling

If any step fails, output the failure report and STOP. Do not push, do not open PR.
