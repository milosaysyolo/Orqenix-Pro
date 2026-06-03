#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# scripts/release/preflight.sh
# Phase 5 tag pre-flight verification.

set -euo pipefail

REPO_KIND="${1:-auto}"
if [[ "$REPO_KIND" == "auto" ]]; then
  if [[ -d "packages/audit-log" ]]; then REPO_KIND="main"
  elif [[ -d "packages/kb-code-graph" ]]; then REPO_KIND="pro"
  else
    echo "ERROR: cannot detect repo kind from $(pwd)" >&2
    exit 1
  fi
fi

REPORT_DIR="release-reports"
mkdir -p "$REPORT_DIR"
TS="$(date -u +%Y-%m-%dT%H-%M-%S)"
REPORT_FILE="$REPORT_DIR/preflight-${REPO_KIND}-${TS}.json"

echo "=== Pre-flight verification: repo=$REPO_KIND ==="

START_MS=$(($(date +%s%N) / 1000000))

# Stage 1: clean install
echo "[1/5] pnpm install --frozen-lockfile=false ..."
pnpm install --frozen-lockfile=false >/dev/null 2>&1 || {
  echo "ERROR: pnpm install failed" >&2
  exit 2
}

# Stage 2: full build
echo "[2/5] pnpm -r build ..."
pnpm -r build >/dev/null 2>&1 || {
  echo "ERROR: workspace build failed" >&2
  exit 3
}

# Stage 3: all unit tests
echo "[3/5] pnpm -r test ..."
pnpm -r test >/dev/null 2>&1 || {
  echo "ERROR: unit tests failed" >&2
  exit 4
}

# Stage 4: charter gates
GATE_DIR="scripts/gates"
declare -a GATES_RUN=()
declare -a GATES_FAILED=()

if [[ "$REPO_KIND" == "main" ]]; then
  GATE_RUNNER="run-all.ts"
  if [[ -f "$GATE_DIR/$GATE_RUNNER" ]]; then
    echo "[4/5] pnpm tsx $GATE_DIR/$GATE_RUNNER ..."
    if pnpm tsx "$GATE_DIR/$GATE_RUNNER"; then
      GATES_RUN+=("run-all")
    else
      GATES_FAILED+=("run-all")
    fi
  else
    echo "[4/5] iterating individual gates..."
    for gate in "$GATE_DIR"/G*.ts; do
      [[ -f "$gate" ]] || continue
      name=$(basename "$gate" .ts)
      if pnpm tsx "$gate" >/dev/null 2>&1; then
        GATES_RUN+=("$name")
      else
        GATES_FAILED+=("$name")
      fi
    done
  fi
  echo "[5/5] phase-5-final-integration ..."
  pnpm tsx "$GATE_DIR/phase-5-final-integration.ts" >/dev/null 2>&1 || {
    echo "ERROR: phase-5-final-integration failed" >&2
    exit 5
  }
elif [[ "$REPO_KIND" == "pro" ]]; then
  for gate in G18-pro G6-pro G36-pro G37-pro; do
    file=$(ls "$GATE_DIR/${gate}"*.ts 2>/dev/null | head -1)
    if [[ -n "$file" ]]; then
      echo "  running $gate ..."
      if pnpm tsx "$file" >/dev/null 2>&1; then
        GATES_RUN+=("$gate")
      else
        GATES_FAILED+=("$gate")
      fi
    fi
  done
  echo "[5/5] pro-final-integration ..."
  pnpm tsx "$GATE_DIR/pro-final-integration.ts" >/dev/null 2>&1 || {
    echo "ERROR: pro-final-integration failed" >&2
    exit 5
  }
  # interop tests (Pro repo only)
  if pnpm --filter @orqenix-pro/integration-tests test >/dev/null 2>&1; then
    GATES_RUN+=("interop-21")
  else
    GATES_FAILED+=("interop-21")
  fi
fi

if (( ${#GATES_FAILED[@]} > 0 )); then
  echo "ERROR: failed gates: ${GATES_FAILED[*]}" >&2
  exit 6
fi

END_MS=$(($(date +%s%N) / 1000000))
DURATION=$((END_MS - START_MS))

cat > "$REPORT_FILE" <<EOF
{
  "repoKind": "${REPO_KIND}",
  "status": "pass",
  "gatesRun": [$(printf '"%s",' "${GATES_RUN[@]}" | sed 's/,$//')],
  "gatesFailed": [],
  "durationMs": ${DURATION},
  "startedAt": "${TS}",
  "node": "$(node -v)",
  "pnpm": "$(pnpm -v)",
  "gitHead": "$(git rev-parse HEAD)",
  "gitBranch": "$(git rev-parse --abbrev-ref HEAD)"
}
EOF

echo ""
echo "✓ Pre-flight PASS for $REPO_KIND repo"
echo "✓ Report: $REPORT_FILE"
echo "✓ Duration: ${DURATION}ms"
