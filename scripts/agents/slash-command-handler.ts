#!/usr/bin/env tsx
/**
 * Slash Command Handler: /orqenix release [major|minor|patch|auto] [reason]
 *
 * Parses slash command from GitHub issue comment body and validates format.
 * Called by release-slash-command.yml workflow.
 */

import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    body: { type: "string" },
    "comment-id": { type: "string" },
    "issue-number": { type: "string" },
  },
});

function parseSlashCommand(body: string): { bump: string; reason: string } | null {
  const match = body.trim().match(/^\/orqenix release\s+(\w+)(?:\s+(.+))?$/);
  if (!match) return null;

  const bump = match[1];
  const reason = match[2] || "Slash command from issue comment";

  if (!["major", "minor", "patch", "auto"].includes(bump)) return null;

  return { bump, reason };
}

function main(): void {
  const body = args.body ?? "";
  const parsed = parseSlashCommand(body);

  if (!parsed) {
    console.error("Invalid slash command format. Use: /orqenix release [major|minor|patch|auto] [reason]");
    process.exit(1);
  }

  console.log(JSON.stringify(parsed));
}

main();
