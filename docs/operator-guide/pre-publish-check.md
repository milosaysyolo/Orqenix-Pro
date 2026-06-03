# Pre-publish Check Operator Guide

## Overview

The pre-publish check is a deterministic validation runner that gates all publish attempts. It runs 24 checks across 6 categories and produces a machine-readable JSON report.

## Running

```bash
# Full check (human-readable)
pnpm tsx scripts/pre-publish-check.ts

# Full check (JSON for CI/agents)
pnpm tsx scripts/pre-publish-check.ts --json-only

# Single check
pnpm tsx scripts/pre-publish-check.ts --check C09

# Allow warnings (don't fail on warnings)
pnpm tsx scripts/pre-publish-check.ts --allow-warn
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All blocking checks pass (or go-with-warnings) |
| 1 | One or more blocking checks fail |
| 2 | Fatal error (check not found, etc.) |

## Understanding the Report

The report is saved to `.orqenix/pre-publish-report.json` (or `.orqenix-pro/`).

Key fields:
- `verdict`: "go", "go-with-warnings", or "no-go"
- `blockingFailures`: count of blocking failures
- `results[]`: individual check results with recommendations

## Whitelist Configuration

Create `.orqenix/publishable-whitelist.yaml` to control which packages get published:

```yaml
version: 1
mode: whitelist
packages:
  - "@orqenix/core"
  - "@orqenix/cli"
```

Set `mode: all` to publish all discovered packages (not recommended for production).

## CI Integration

In CI, use `--json-only` flag and parse the JSON report:

```bash
pnpm tsx scripts/pre-publish-check.ts --json-only
REPORT=$(cat .orqenix/pre-publish-report.json)
if [ "$(echo $REPORT | jq -r '.verdict')" = "no-go" ]; then
  echo "Pre-publish checks failed"
  exit 1
fi
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| C08 fails | package.json missing fields | Run `pnpm tsx scripts/normalize-packages.ts --apply` |
| C09 fails | Package not in whitelist | Add to `publishable-whitelist.yaml` |
| C10 fails | Cross-repo workspace:* dep | Convert to version range |
| C13 fails | dist/ missing | Run `pnpm build` |
| C21 fails | No changeset | Run `pnpm changeset` |
