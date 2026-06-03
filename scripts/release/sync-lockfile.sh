#!/usr/bin/env bash
# Sync pnpm-lock.yaml with root package.json.
# Safe to run locally or in CI. Idempotent.
#
# Exit codes:
#   0 - success (or already in sync)
#   1 - sync failed (drift remains or verification failed)
#   2 - precondition failed (wrong dir, missing tools, etc.)

set -euo pipefail

log() {
  echo "[sync-lockfile] $*"
}

err() {
  echo "[sync-lockfile][ERROR] $*" >&2
}

# Precondition: must be at repo root with package.json and pnpm-lock.yaml
if [ ! -f "package.json" ]; then
  err "package.json not found. Run from repo root."
  exit 2
fi

if [ ! -f "pnpm-lock.yaml" ]; then
  err "pnpm-lock.yaml not found. Run from repo root."
  exit 2
fi

# Step 1: Activate pinned pnpm
log "Step 1: Activate pinned pnpm version"
if ! command -v corepack >/dev/null 2>&1; then
  err "corepack not found. Install Node.js >= 16.10 or enable corepack."
  exit 2
fi

corepack enable >/dev/null 2>&1 || true
PNPM_VERSION=$(node -p "require('./package.json').packageManager?.split('@')[1] || ''")
if [ -z "$PNPM_VERSION" ]; then
  err "packageManager field not set in package.json. Pin it (e.g., 'pnpm@9.12.0')."
  exit 2
fi
corepack prepare "pnpm@${PNPM_VERSION}" --activate >/dev/null
log "Using pnpm $(pnpm --version) (pinned: ${PNPM_VERSION})"

# Step 2: Ensure yaml parser available for drift script
if [ ! -d "node_modules/yaml" ] && ! npm ls -g yaml >/dev/null 2>&1; then
  log "Step 2: Install local yaml parser for drift check"
  npm install --no-save --no-package-lock yaml@2 >/dev/null 2>&1 || true
fi

# Step 3: Detect drift before
log "Step 3: Detect drift (before sync)"
if node scripts/release/check-lockfile-drift.mjs >/dev/null 2>&1; then
  log "Lockfile already in sync. Nothing to do."
  exit 0
fi

log "Drift detected. Proceeding with regeneration."

# Step 4: Regenerate lockfile (no node_modules install, scripts ignored)
log "Step 4: Regenerate lockfile (--lockfile-only)"
export NPM_CONFIG_IGNORE_SCRIPTS=true
pnpm install --lockfile-only

# Step 5: Verify --frozen-lockfile now passes
log "Step 5: Verify --frozen-lockfile passes"
if ! pnpm install --frozen-lockfile --lockfile-only >/dev/null 2>&1; then
  err "Lockfile still out of sync after regeneration. Manual investigation required."
  exit 1
fi

# Step 6: Verify allowlist preserved
log "Step 6: Verify onlyBuiltDependencies allowlist"
if ! node scripts/release/verify-only-built-deps.mjs >/dev/null 2>&1; then
  err "onlyBuiltDependencies allowlist drift detected."
  exit 1
fi

# Step 7: Show diff summary
log "Step 7: Diff summary"
git --no-pager diff --stat pnpm-lock.yaml || true

UNAUTHORIZED=$(git status --porcelain | awk '{print $2}' | grep -v -E '^(pnpm-lock\.yaml)$' || true)
if [ -n "$UNAUTHORIZED" ]; then
  err "Unexpected files modified during sync:"
  echo "$UNAUTHORIZED" >&2
  exit 1
fi

log "Done. Lockfile is in sync."
log "Next steps:"
log "  git add pnpm-lock.yaml"
log "  git commit -m 'chore: sync pnpm-lock.yaml'"
log "  git push"
