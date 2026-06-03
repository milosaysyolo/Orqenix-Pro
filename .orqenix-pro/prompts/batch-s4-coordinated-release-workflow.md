# Agent Prompt: Batch S4 — Coordinated Release Workflow (Pro)

## Role
You are the Orqenix-Pro Release Setup Agent, Batch S4 executor. Ship coordinated GitHub Actions workflows to publish Pro safely, triggered by OSS release.

## Context
- Pro repo: github.com/milosaysyolo/Orqenix-Pro
- OSS repo: github.com/milosaysyolo/Orqenix
- Whitelist: 7 packages
- Cross-scope deps: workspace:* deps to @orqenix/* must be converted before Pro publish
- Pro accepts both repository_dispatch (from OSS trigger-pro.yml) and workflow_dispatch (direct manual)

## Tasks

### Pro Repo Files
1. .github/workflows/release.yml
2. .github/workflows/pre-flight.yml
3. .github/actions/wait-for-npm/action.yml
4. scripts/convert-cross-scope-deps.ts
5. scripts/__tests__/convert-cross-scope-deps.test.ts
6. .orqenix-pro/schemas/pre-publish-report.schema.json
7. .orqenix-pro/prompts/batch-s4-coordinated-release-workflow.md (this file)

## Constraints
- NPM_TOKEN_PRO never logged
- Concurrency control prevents two simultaneous releases
- All workflow files must pass actionlint
- All scripts must have unit tests
- No actual publish in this PR (dry-run only)
- Pro release.yml accepts both repository_dispatch and workflow_dispatch
- workflow_dispatch in Pro accepts manual oss_version input

## Deliverables
- Branch: release-setup/batch-s4
- Commit messages:
  - "ci(release): add Pro release workflow [Batch S4]"
  - "ci(release): add PR pre-flight workflow (Pro) [Batch S4]"
  - "ci(release): add wait-for-npm composite action [Batch S4]"
  - "feat(release): add cross-scope dep converter script [Batch S4]"

## Validation Before Commit
- actionlint on all .github/workflows/*.yml
- pnpm vitest run scripts/__tests__/convert-cross-scope-deps.test.ts
- jq . on all .orqenix-pro/schemas/*.json (valid JSON)
- Manual review: no NPM_TOKEN echoed in step outputs

## Stop Conditions
Stop and ask Milo if:
- .github/workflows/ already contains a release.yml with different structure
- Required secrets missing (NPM_TOKEN_PRO, ORQENIX_COORDINATOR_PAT)
- pre-publish-check.ts not yet in repo
