# Changesets

This folder is managed by https://github.com/changesets/changesets.

## What is a changeset?

A changeset is a Markdown file that describes a change to one or more packages, along with the version bump required (`major`, `minor`, or `patch`). Changesets are consumed by CI to bump versions and publish to npm.

## How to add a changeset

```bash
pnpm changeset
```

Follow the prompts:
1. Select packages affected by your change
2. Choose bump type per package (`major` / `minor` / `patch`)
3. Write a clear summary that will appear in CHANGELOG.md

Commit the generated `.md` file in this folder along with your code changes.

## How releases happen

1. PRs with changesets are merged to `main`
2. CI opens a "Version Packages" PR that bumps versions and updates CHANGELOG
3. When that PR is merged, CI publishes the packages to npm

You do not need to manually bump versions or publish. The `release-lead` agent and CI handle this.

## Bump type guide

| Type | When to use |
|---|---|
| `major` | Breaking change: removed API, changed function signature, changed required config |
| `minor` | New feature: new export, new optional config, backward-compatible enhancement |
| `patch` | Bug fix: no API change, documentation, dependency update |

## Pre-release strategy

This repo uses pure semver for npm versions (e.g., `0.5.0`). Phase milestones are tracked via Git tags only (e.g., `v0.5.0-phase-5`).

For prerelease (alpha/beta/rc), use:

```bash
pnpm changeset pre enter alpha
pnpm changeset
pnpm changeset version
pnpm changeset pre exit
```
