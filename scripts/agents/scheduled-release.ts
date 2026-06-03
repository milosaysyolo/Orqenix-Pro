#!/usr/bin/env tsx
/**
 * Scheduled Release Entry
 *
 * Called by release-scheduled.yml (weekly Monday 09:00 ICT).
 * Runs release-propose.ts with auto-bump.
 */

import { execa } from "execa";

async function main(): Promise<void> {
  console.log("Orqenix Scheduled Release (Monday 09:00 ICT)");

  const { exitCode, stdout, stderr } = await execa("pnpm", [
    "tsx",
    "scripts/agents/release-propose.ts",
    "--bump=auto",
    "--reason=Weekly scheduled cadence (Monday 09:00 ICT)",
  ], { reject: false });

  console.log(stdout);

  if (exitCode === 0) {
    console.log("Scheduled release completed successfully.");
    process.exit(0);
  }

  if (stdout.includes("Nothing to release") || stdout.includes("No packages need bumping")) {
    console.log("No release needed this week.");
    process.exit(0);
  }

  console.error("Scheduled release failed:", stderr);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
