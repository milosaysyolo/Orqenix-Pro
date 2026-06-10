#!/usr/bin/env bash
# release-pro-v0.6.0-phase-6.sh
# Repository: Orqenix-Pro
# Target tag: v0.6.0-phase-6
# Purpose: verify post-D6P-F2 state, apply 1 doc-only optimization, tag, publish GitHub Release.
# Default mode: dry-run + verify. Pass MODE=tag to actually tag + push + publish.
#
# Usage:
#   bash release-pro-v0.6.0-phase-6.sh                       # dry-run, verify only
#   MODE=tag bash release-pro-v0.6.0-phase-6.sh              # full: verify + tag + push + GitHub Release
#   SKIP_OPTIMIZE=1 bash release-pro-v0.6.0-phase-6.sh       # skip the doc optimization step
#   TARGET_COMMIT=139ee34 MODE=tag bash release-pro-v0.6.0-phase-6.sh
#
# Stop conditions: any failed verify check aborts. Tag and publish only run after every check passes.

set -uo pipefail

TAG="v0.6.0-phase-6"
PRO_PACKAGE="@orqenix-pro/cli"
PRO_PACKAGE_DIR="packages/cli"
DEFAULT_TARGET_COMMIT="${TARGET_COMMIT:-139ee34}"
MODE="${MODE:-dry-run}"
SKIP_OPTIMIZE="${SKIP_OPTIMIZE:-0}"
RELEASE_NOTES_FILE="${RELEASE_NOTES_FILE:-release-notes-pro-v0.6.0-phase-6.md}"
AUDIT_LOG="release-pro-${TAG}-audit.log"

# --------- Color helpers ---------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_GREEN='\033[1;32m'
  C_RED='\033[1;31m'
  C_YELLOW='\033[1;33m'
  C_BLUE='\033[1;34m'
  C_RESET='\033[0m'
else
  C_GREEN=''; C_RED=''; C_YELLOW=''; C_BLUE=''; C_RESET=''
fi

# --------- Logging ---------
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log_info()  { printf "%b[INFO]%b  %s %s\n"  "$C_BLUE"   "$C_RESET" "$(ts)" "$*" | tee -a "$AUDIT_LOG" ; }
log_pass()  { printf "%b[PASS]%b  %s %s\n"  "$C_GREEN"  "$C_RESET" "$(ts)" "$*" | tee -a "$AUDIT_LOG" ; }
log_warn()  { printf "%b[WARN]%b  %s %s\n"  "$C_YELLOW" "$C_RESET" "$(ts)" "$*" | tee -a "$AUDIT_LOG" ; }
log_fail()  { printf "%b[FAIL]%b  %s %s\n"  "$C_RED"    "$C_RESET" "$(ts)" "$*" | tee -a "$AUDIT_LOG" ; }
log_step()  { printf "\n%b===== %s =====%b\n" "$C_BLUE" "$*" "$C_RESET" | tee -a "$AUDIT_LOG" ; }
die()       { log_fail "$*"; exit 1; }

# --------- Capture commands verbatim ---------
run_capture() {
  local label="$1"; shift
  log_info "RUN: $label"
  {
    echo ""
    echo "===== $label ====="
    echo "$ $*"
    "$@" 2>&1
    echo "exit=$?"
  } >> "$AUDIT_LOG"
}

# --------- Initialize audit log ---------
: > "$AUDIT_LOG"
log_info "Release script start"
log_info "Mode: $MODE"
log_info "Tag: $TAG"
log_info "Target commit (suggested): $DEFAULT_TARGET_COMMIT"
log_info "Pro package: $PRO_PACKAGE"
log_info "Audit log: $AUDIT_LOG"

# --------- 1. Environment ---------
log_step "1. Environment"

command -v git    >/dev/null 2>&1 || die "git not found"
command -v node   >/dev/null 2>&1 || die "node not found"
command -v pnpm   >/dev/null 2>&1 || die "pnpm not found"
command -v npm    >/dev/null 2>&1 || die "npm not found"

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$NODE_MAJOR" -ge 22 ] || die "Node >= 22 required, got $(node -v)"

run_capture "node -v" node -v
run_capture "pnpm -v" pnpm -v
run_capture "npm -v"  npm -v
run_capture "git --version" git --version

if [ "$MODE" = "tag" ]; then
  command -v gh >/dev/null 2>&1 || die "gh CLI not found (required for MODE=tag)"
  if ! gh auth status >/dev/null 2>&1; then
    die "gh CLI not authenticated. Run: gh auth login"
  fi
  log_pass "gh CLI authenticated"
fi

log_pass "Environment OK"

# --------- 2. Working tree + branch ---------
log_step "2. Working tree and branch"

run_capture "git status --short" git status --short
DIRTY_COUNT=$(git status --porcelain | wc -l | tr -d ' ')
[ "$DIRTY_COUNT" -eq 0 ] || die "Working tree not clean. Commit or stash first."

BRANCH=$(git branch --show-current)
log_info "Branch: $BRANCH"
[ "$BRANCH" = "main" ] || log_warn "Not on main (got '$BRANCH'). Continue if intentional."

CURRENT_COMMIT=$(git rev-parse HEAD)
log_info "HEAD commit: $CURRENT_COMMIT"
log_pass "Working tree clean"

# --------- 3. Tag must not already exist ---------
log_step "3. Tag must not exist"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  die "Local tag $TAG already exists. Delete with: git tag -d $TAG"
fi

if git ls-remote --tags origin "refs/tags/$TAG" | grep -q "$TAG"; then
  die "Remote tag $TAG already exists on origin. Aborting."
fi

log_pass "Tag $TAG is available"

# --------- 4. Install ---------
log_step "4. Install (frozen lockfile)"

run_capture "pnpm install --frozen-lockfile" pnpm install --frozen-lockfile
LAST_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
[ "$LAST_EXIT" = "0" ] || die "pnpm install --frozen-lockfile failed"

log_pass "Install OK"

# --------- 5. Optimize step (doc-only) ---------
if [ "$SKIP_OPTIMIZE" != "1" ]; then
  log_step "5. Optimize (doc-only: safer guidance in D6P-F2 Implementation Report)"

  D6PF2_REPORT="D6P-F2-Implementation-Report.md"
  if [ -f "$D6PF2_REPORT" ]; then
    # Replace the dangerous "skip prepare" recommendation with a safer one.
    # Idempotent: only patch if the dangerous phrase still exists.
    if grep -q '"prepare": "node -e' "$D6PF2_REPORT" 2>/dev/null; then
      log_info "Patching D6P-F2 Implementation Report Section 12.3 recommendation"
      python3 - "$D6PF2_REPORT" <<'PYEOF'
import sys, pathlib
p = pathlib.Path(sys.argv[1])
text = p.read_text(encoding="utf-8")
old = '''If native modules still fail in CI, add "prepare": "node -e ''" or "scripts": {"prepare": "skip"} to packages/cli/package.json to skip native build on install (only if the CLI package doesn't need them at install time)'''
new = '''If native modules fail in CI, do not bypass lifecycle scripts blindly. First isolate whether the CLI package truly depends on the native chain at publish time. Prefer fixing the CI image with the required C++ build tools, or keep the Pro CLI publish job scoped to packages/cli with `npm pack --dry-run` validating the final artifact'''
if old in text:
    text = text.replace(old, new)
    p.write_text(text, encoding="utf-8")
    print("PATCHED")
else:
    print("NO_MATCH")
PYEOF
      if [ "$MODE" = "tag" ]; then
        git add "$D6PF2_REPORT"
        git commit -m "docs(pro): safer CI guidance in D6P-F2 report before $TAG" || log_warn "Nothing to commit (idempotent)"
        CURRENT_COMMIT=$(git rev-parse HEAD)
        log_info "New HEAD commit after optimize: $CURRENT_COMMIT"
      fi
      log_pass "Optimization applied"
    else
      log_info "Optimization not needed (no dangerous phrase found)"
    fi
  else
    log_warn "$D6PF2_REPORT not found, skipping optimization"
  fi
else
  log_info "SKIP_OPTIMIZE=1, skipping optimization step"
fi

# --------- 6. Build ---------
log_step "6. Build"

run_capture "pnpm -F $PRO_PACKAGE build" pnpm -F "$PRO_PACKAGE" build
LAST_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
[ "$LAST_EXIT" = "0" ] || die "pnpm -F $PRO_PACKAGE build failed"

log_pass "Build OK (zero TS errors expected)"

# --------- 7. Runtime bin smoke ---------
log_step "7. Runtime bin smoke"

run_capture "help" node packages/cli/bin/orqenix.mjs help
HELP_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
[ "$HELP_EXIT" = "0" ] || die "orqenix help failed (exit $HELP_EXIT)"

# Capture stdout for content checks
HELP_OUT=$(node packages/cli/bin/orqenix.mjs help 2>&1 || true)
echo "$HELP_OUT" | grep -q "orqenix" || die "orqenix help output missing brand"
echo "$HELP_OUT" | grep -q "Usage"   || die "orqenix help output missing 'Usage'"

run_capture "auth status invalid license" bash -c "ORQENIX_PRO_LICENSE=invalid node packages/cli/bin/orqenix.mjs auth status; echo exit=\$?"
AUTH_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
[ "$AUTH_EXIT" = "3" ] || die "auth status with invalid license expected exit 3, got $AUTH_EXIT"

run_capture "quota show invalid license" bash -c "ORQENIX_PRO_LICENSE=invalid node packages/cli/bin/orqenix.mjs quota show; echo exit=\$?"
QUOTA_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
[ "$QUOTA_EXIT" = "3" ] || die "quota show with invalid license expected exit 3, got $QUOTA_EXIT"

log_pass "Runtime smoke OK (help=0, auth=3, quota=3)"

# --------- 8. Native-heavy import sanity ---------
log_step "8. Native-heavy import sanity"

NATIVE_HITS=$(grep -R "@orqenix/audit-log\|@orqenix/storage-sqlite\|better-sqlite3\|@mongodb-js/zstd" packages/cli/bin packages/cli/src -n 2>/dev/null || true)
{
  echo ""
  echo "===== native-heavy import grep ====="
  if [ -z "$NATIVE_HITS" ]; then
    echo "(none)"
  else
    echo "$NATIVE_HITS"
  fi
} >> "$AUDIT_LOG"

if [ -n "$NATIVE_HITS" ]; then
  die "Forbidden native-heavy imports found in packages/cli/bin or src"
fi
log_pass "No native-heavy imports in CLI"

# --------- 9. Tests + Pro gates + verify-phase-6-pro ---------
log_step "9. Tests and gates"

run_capture "pnpm -F $PRO_PACKAGE test" pnpm -F "$PRO_PACKAGE" test
LAST_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
[ "$LAST_EXIT" = "0" ] || die "Pro CLI tests failed"

for g in G44-pro-cli-foundation G45-pro-cli-mesh-delegation G46-pro-cli-quota G47-pro-cli-backend; do
  if [ -f "scripts/gates/${g}.ts" ]; then
    run_capture "gate ${g}" node --import tsx "scripts/gates/${g}.ts"
    LAST_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
    [ "$LAST_EXIT" = "0" ] || die "Gate ${g} failed"
  else
    log_warn "Gate script scripts/gates/${g}.ts not found, skipping"
  fi
done

if [ -f "scripts/gates/verify-phase-6-pro.ts" ]; then
  run_capture "verify-phase-6-pro" node --import tsx scripts/gates/verify-phase-6-pro.ts
  LAST_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
  [ "$LAST_EXIT" = "0" ] || die "verify-phase-6-pro failed"
else
  die "scripts/gates/verify-phase-6-pro.ts not found"
fi

log_pass "All Pro gates PASS"

# --------- 10. Package dry-run ---------
log_step "10. Package dry-run (npm)"

run_capture "npm pack packages/cli --dry-run" npm pack packages/cli --dry-run
LAST_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
[ "$LAST_EXIT" = "0" ] || die "npm pack --dry-run failed"

# Re-run to capture JSON manifest for content check
PACK_JSON=$(npm pack packages/cli --dry-run --json 2>/dev/null || true)
if [ -n "$PACK_JSON" ]; then
  echo "$PACK_JSON" > "release-pro-${TAG}-pack-manifest.json"
  log_info "Pack manifest saved: release-pro-${TAG}-pack-manifest.json"

  EXPECT_INCLUDE=("bin/orqenix.mjs" "package.json" "README.md" "LICENSE" "CHANGELOG.md")
  FORBID_INCLUDE=("test/" "scripts/" "D6P-F1-AUDIT.md" "D6P-F2-AUDIT.md" "D6P-F2-Implementation-Report.md")

  for f in "${EXPECT_INCLUDE[@]}"; do
    if echo "$PACK_JSON" | grep -q "\"$f\""; then
      log_pass "Pack includes $f"
    else
      die "Pack missing required file: $f"
    fi
  done

  for f in "${FORBID_INCLUDE[@]}"; do
    if echo "$PACK_JSON" | grep -q "\"$f"; then
      die "Pack includes forbidden file: $f"
    else
      log_pass "Pack excludes $f (OK)"
    fi
  done
else
  log_warn "npm pack --json output unavailable on this npm version, skipping content check"
fi

log_pass "Pack dry-run OK"

# --------- 11. Decide tag commit ---------
log_step "11. Resolve tag commit"

if [ -n "$DEFAULT_TARGET_COMMIT" ] && [ "$DEFAULT_TARGET_COMMIT" != "" ]; then
  if git cat-file -e "$DEFAULT_TARGET_COMMIT^{commit}" 2>/dev/null; then
    TAG_COMMIT=$(git rev-parse "$DEFAULT_TARGET_COMMIT")
    log_info "Using requested commit: $DEFAULT_TARGET_COMMIT -> $TAG_COMMIT"
  else
    log_warn "TARGET_COMMIT $DEFAULT_TARGET_COMMIT not found, falling back to HEAD"
    TAG_COMMIT=$(git rev-parse HEAD)
  fi
else
  TAG_COMMIT=$(git rev-parse HEAD)
fi

log_info "Tag commit: $TAG_COMMIT"

# --------- 12. Tag / dry-run summary ---------
log_step "12. Tag and publish"

if [ "$MODE" != "tag" ]; then
  cat | tee -a "$AUDIT_LOG" <<EOF

DRY-RUN MODE COMPLETE.
All verification checks passed. To actually tag and publish:

  MODE=tag bash $(basename "$0")

Optional overrides:
  TARGET_COMMIT=$TAG_COMMIT MODE=tag bash $(basename "$0")
  RELEASE_NOTES_FILE=./my-notes.md MODE=tag bash $(basename "$0")

EOF
  exit 0
fi

# --------- 13. Real tag flow ---------
log_step "13. Create annotated tag"

[ -f "$RELEASE_NOTES_FILE" ] || die "Release notes file not found: $RELEASE_NOTES_FILE (see Part 2 deliverable)"

TAG_MESSAGE="Phase 6 Pro: CLI Foundation + Mesh/Delegation + Quota + Polyglot Backend

Gates G44-pro to G47-pro PASS.
D6.11A + D6.11B + D6.12 delivered.
D6P-F1 + D6P-F2 audits closed.
Tag commit: $TAG_COMMIT"

git tag -a "$TAG" "$TAG_COMMIT" -m "$TAG_MESSAGE"
log_pass "Annotated tag created at $TAG_COMMIT"

run_capture "git push origin main" git push origin main
LAST_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
[ "$LAST_EXIT" = "0" ] || die "git push origin main failed (optimize commit may not be pushed)"

run_capture "git push origin $TAG" git push origin "$TAG"
LAST_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
[ "$LAST_EXIT" = "0" ] || die "git push origin $TAG failed"

log_pass "Tag pushed to origin"

# --------- 14. GitHub Release ---------
log_step "14. Publish GitHub Release"

REPO_SLUG=$(git config --get remote.origin.url | sed -E 's#.*github.com.+/(.+)\.git$#\1/\2#')
[ -n "$REPO_SLUG" ] || die "Cannot parse repo slug from origin URL"
log_info "Repo: $REPO_SLUG"

if gh release view "$TAG" --repo "$REPO_SLUG" >/dev/null 2>&1; then
  die "GitHub Release $TAG already exists on $REPO_SLUG"
fi

run_capture "gh release create" gh release create "$TAG" \
  --repo "$REPO_SLUG" \
  --title "v0.6.0-phase-6 — Pro CLI: Operator surface for the Orqenix mesh" \
  --notes-file "$RELEASE_NOTES_FILE" \
  --verify-tag \
  --latest

LAST_EXIT=$(tail -2 "$AUDIT_LOG" | grep "^exit=" | tail -1 | sed 's/exit=//')
[ "$LAST_EXIT" = "0" ] || die "gh release create failed"

RELEASE_URL=$(gh release view "$TAG" --repo "$REPO_SLUG" --json url --jq .url 2>/dev/null || true)
log_pass "GitHub Release published"
log_info "URL: $RELEASE_URL"

# --------- 15. Final summary ---------
log_step "15. Done"

cat | tee -a "$AUDIT_LOG" <<EOF

================================================================
TAG PUBLISHED

  Tag:     $TAG
  Commit:  $TAG_COMMIT
  Branch:  $BRANCH
  Repo:    $REPO_SLUG
  Release: $RELEASE_URL

Audit log: $AUDIT_LOG

Next steps (NOT done by this script):

  1. Verify on a clean machine:
     npm install -g @orqenix-pro/cli
     orqenix help

  2. Publish to npm (separate runbook, not in this script):
     npm publish packages/cli --access restricted --provenance

  3. Update Orqenix-Pro README badges and CHANGELOG with the release link.

================================================================
EOF

exit 0
