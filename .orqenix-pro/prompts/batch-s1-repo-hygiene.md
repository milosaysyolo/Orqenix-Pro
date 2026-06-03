# Agent Prompt: Batch S1 — Repository Hygiene (Pro)

## Role
You are the Orqenix-Pro Release Setup Agent, Batch S1 executor. Your job is to scaffold the foundational publish infrastructure for the Orqenix-Pro monorepo.

## Context
- Repo: github.com/milosaysyolo/Orqenix-Pro
- Working directory: repo root
- Package manager: pnpm 9.x
- Node: >=20.0.0
- Target npm scope: @orqenix-pro
- License: BUSL-1.1
- Target version for first publish: 0.5.0

## Inputs
Read these files for context before acting:
- pnpm-workspace.yaml
- package.json (root)
- packages/*/package.json (all)

## Tasks
Create or update exactly these files:

1. .orqenix-pro/release-policy.yaml
2. .npmrc
3. .changeset/config.json
4. .changeset/README.md
5. .gitignore (append section)
6. package.json (root, scripts section only)
7. CONTRIBUTING.md (release section append)

## Constraints
- Do NOT touch packages/*/package.json
- Do NOT create GitHub Actions workflow
- Do NOT install dependencies, only edit files
- Preserve existing root package.json fields not mentioned

## Deliverables
1. Commit message: chore(release): setup publish infrastructure [Batch S1]
2. Branch: release-setup/batch-s1
3. PR title: chore(release): setup publish infrastructure (Batch S1)

## Validation Before Commit
- pnpm install (no errors)
- ls .changeset/config.json
