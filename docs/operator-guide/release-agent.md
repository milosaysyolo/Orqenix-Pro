# Release Agent Operator Guide (Batch S5)

## Overview

The `release-lead` agent automates the end-to-end release proposal workflow.
You trigger it with one command; it creates a release branch, commits a changeset, runs pre-publish check, and opens a PR for human review.

## Trigger methods

### Local CLI
```bash
pnpm tsx scripts/agents/release-propose.ts --bump minor --reason "v0.5.0 Phase 5"
```

### GitHub Slash Command
Comment `/orqenix release minor v0.5.0 Phase 5 release` in any GitHub issue (OWNER only).

### Weekly Scheduled
Runs automatically Monday 09:00 ICT via `release-scheduled.yml`.

## Release agent flow

```
Trigger -> Detect changes -> Classify commits -> Propose bumps
  -> Generate changeset -> Create branch -> Pre-publish check
  -> Open PR -> STOP (human merges) -> CI publishes
```

## Safety guardrails

| Constraint | Enforced by |
|---|---|
| No publish | Agent has NO npm-publish tool |
| No merge | Agent has NO github-pr-merge tool |
| No policy changes | Agent CANNOT modify release-policy.yaml |
| No whitelist changes | Agent CANNOT modify publishable-whitelist.yaml |
| No secret access | Agent CANNOT read NPM_TOKEN |
| Audit trail | Every action logged with BLAKE3 chain |

## Files created

| Path | Purpose |
|---|---|
| `packages/teams-built-in/agents/release-lead.md` | Agent definition |
| `packages/teams-built-in/agents/release-validator.md` | Post-publish validator |
| `packages/teams-built-in/agents/release-coordinator.md` | Multi-repo coordinator |
| `packages/skills/release/*/` | 8 skill implementations |
| `scripts/agents/release-propose.ts` | CLI entry point |
| `scripts/agents/slash-command-handler.ts` | Slash command parser |
| `scripts/agents/scheduled-release.ts` | Cron entry |
| `.github/workflows/release-slash-command.yml` | Slash command workflow |
| `.github/workflows/release-scheduled.yml` | Weekly cadence |
| `.orqenix/release-audit.log` | BLAKE3 hash-chained audit log |
