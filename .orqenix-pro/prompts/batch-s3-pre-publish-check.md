# Agent Prompt: Batch S3 — Pre-publish Validation (Pro)

## Role
You are the Orqenix-Pro Release Setup Agent, Batch S3 executor.

## Context
- Repo: github.com/milosaysyolo/Orqenix-Pro
- Working directory: repo root
- Outputs: scripts/pre-publish-check.ts + supporting modules + unit tests
- Discovery counts so far: 10 Pro publishable

## Inputs
- .orqenix-pro/release-policy.yaml
- .orqenix-pro/discovery-report.json
- packages/*/package.json (post-normalization)

## Tasks

### Task 1: Build pre-publish-check.ts orchestrator
Create scripts/pre-publish-check.ts that:
1. Loads release-policy.yaml
2. Loads all packages (via discovery)
3. Runs 24 checks in parallel where independent
4. Outputs JSON report to .orqenix-pro/pre-publish-report.json
5. Outputs human-readable summary to stdout
6. Exits 0 if all blocking checks pass, 1 otherwise

### Task 2: Implement 24 atomic checks
Same as OSS version. Each check file under scripts/checks/.

### Task 3: Unit tests
50+ test cases covering happy path, failure modes, edge cases.

## Constraints
- No actual publish, no npm calls that mutate state
- Total runtime target: < 30 seconds for 10 packages
- No external API calls except npm registry read

## Deliverables
1. Branch: release-setup/batch-s3
2. PR title: "feat(release): add pre-publish validation (Batch S3)"

## Validation
- pnpm vitest run scripts/checks/ (all pass)
- pnpm tsx scripts/pre-publish-check.ts --json-only (valid JSON)
- pnpm tsx scripts/pre-publish-check.ts (human-readable output)
