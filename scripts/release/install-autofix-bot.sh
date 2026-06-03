#!/usr/bin/env bash
# One-shot installer that creates all autofix bot files in the correct paths.
# Run from repo root: bash scripts/release/install-autofix-bot.sh
# Idempotent: safe to re-run.

set -euo pipefail

log() { echo "[install-autofix-bot] $*"; }

if [ ! -f "package.json" ]; then
  echo "ERROR: run from repo root" >&2
  exit 1
fi

log "Creating directories"
mkdir -p .github/workflows
mkdir -p scripts/release
mkdir -p docs/release

log "Checking files exist (created in previous deliverable)"
for f in \
  ".github/workflows/lockfile-guard.yml" \
  ".github/workflows/lockfile-autofix.yml" \
  "scripts/release/sync-lockfile.sh" \
  "scripts/release/check-lockfile-drift.mjs" \
  "scripts/release/verify-only-built-deps.mjs" \
  "docs/release/lockfile-autofix.md"; do
  if [ -f "$f" ]; then
    log "  OK: $f"
  else
    echo "  MISSING: $f" >&2
    echo "  Copy from the deliverable kit, then re-run this installer." >&2
    exit 1
  fi
done

log "Setting executable bit on shell scripts"
chmod +x scripts/release/sync-lockfile.sh
chmod +x scripts/release/install-autofix-bot.sh

log "Ensuring yaml dep in root package.json"
if ! node -e "process.exit(require('./package.json').devDependencies?.yaml ? 0 : 1)"; then
  log "  Adding yaml@^2.5.0 to devDependencies"
  node <<'EOF'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.devDependencies = pkg.devDependencies || {};
pkg.devDependencies.yaml = pkg.devDependencies.yaml || '^2.5.0';
pkg.scripts = pkg.scripts || {};
pkg.scripts['lockfile:check'] = 'node scripts/release/check-lockfile-drift.mjs';
pkg.scripts['lockfile:sync'] = 'bash scripts/release/sync-lockfile.sh';
pkg.scripts['lockfile:verify-allowlist'] = 'node scripts/release/verify-only-built-deps.mjs';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
EOF
fi

log "Done. Next steps:"
log "  1. pnpm install --lockfile-only"
log "  2. pnpm run lockfile:check    # should print IN_SYNC"
log "  3. git add . && git commit -m 'feat(ci): add lockfile autofix bot'"
log "  4. git push and open a test PR to verify"
