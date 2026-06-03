# Agent Prompt: Batch S5 — Release Agent

## Role
Ship `release-lead` and `release-validator` agents that automate the entire release proposal workflow. Anh chỉ cần 1 command, agent làm hết phần còn lại đến khi human approves PR.

## Context
- Both repos: github.com/milosaysyolo/Orqenix and github.com/milosaysyolo/Orqenix-Pro
- Whitelist verified (Batch S5 prerequisite)
- Batch S1-S4 fully shipped
- Pre-publish-check working (Batch S3)
- Release workflows working (Batch S4)

## Tasks

### Task 1: Agent definitions (in OSS + Pro repos)
- packages/teams-built-in/agents/release-lead.md
- packages/teams-built-in/agents/release-validator.md
- packages/teams-built-in/agents/release-coordinator.md (OSS only, coordinates Pro)

### Task 2: Skill packages (in OSS + Pro repos)
8 skills under packages/skills/release/, each:
- index.ts: deterministic implementation
- prompt.md: agent-facing description
- README.md: human docs
- __tests__/*.test.ts: unit tests

### Task 3: CLI entry point
- scripts/agents/release-propose.ts: `orqenix release propose` command
- scripts/agents/slash-command-handler.ts: parses /orqenix release [type]
- scripts/agents/scheduled-release.ts: cron-friendly entry

### Task 4: GitHub workflows
- .github/workflows/release-slash-command.yml: listen on issue_comment
- .github/workflows/release-scheduled.yml: weekly Monday 09:00 ICT

### Task 5: Audit log
- BLAKE3 hash-chain in .orqenix/release-audit.log
- Each agent action appends an entry
- Tamper-evident chain (compatible with Phase 5 Part 12A audit-log)

### Task 6: Tests
- Unit tests for each skill (target 80% coverage)
- Integration test: dry-run end-to-end propose flow
- Audit log tamper detection test

## Constraints
- Agent has NO npm-publish tool
- Agent has NO git-push-main tool
- Agent has NO github-pr-merge tool
- Agent has NO github-pr-approve tool
- Agent CANNOT modify release-policy.yaml
- Agent CANNOT modify publishable-whitelist.yaml
- Agent CANNOT read NPM_TOKEN
- Agent CANNOT force push
- Agent appends to audit-log on every action

## Stop Conditions
Agent stops and asks Milo if:
- No changesets needed (no publishable changes since last tag)
- Conflicting changesets exist (e.g., 2 changesets bump same package differently)
- Whitelist mismatch detected
- Pre-publish-check returns "no-go"
- Release branch already exists with uncommitted state

## Deliverables (per repo, both OSS and Pro)
- Branch: release-setup/batch-s5
- Commits split by domain:
  - "feat(agents): add release-lead agent definition [Batch S5]"
  - "feat(skills): add 8 release skills [Batch S5]"
  - "feat(cli): add release propose CLI entry [Batch S5]"
  - "ci(release): add slash command + scheduled workflows [Batch S5]"
  - "feat(audit): add release audit log with BLAKE3 chain [Batch S5]"
  - "test(release): add unit + integration tests [Batch S5]"
- PR title: "feat(release): release agent automation (Batch S5)"

## Validation Before Commit
- pnpm vitest run packages/skills/release (all pass)
- pnpm tsx scripts/agents/release-propose.ts --dry-run (works without errors)
- actionlint on new workflows
- Manual: simulate /orqenix release minor in test issue
- Manual: verify audit log entries are hash-chained correctly
