#!/usr/bin/env tsx
/**
 * orqenix release propose [--bump TYPE] [--scope PATTERN] [--reason TEXT] [--dry-run]
 *
 * CLI entry point for release-lead agent. Orchestrates all skills.
 */

import { parseArgs } from "node:util";
import { execa } from "execa";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";

import * as detectChanged from "../../packages/skills/release/detect-changed-packages";
import * as classify from "../../packages/skills/release/classify-changes";
import * as proposeBump from "../../packages/skills/release/propose-bump";
import * as generateChangeset from "../../packages/skills/release/generate-changeset";
import * as createBranch from "../../packages/skills/release/create-release-branch";
import * as openPR from "../../packages/skills/release/open-release-pr";
import * as auditLog from "../../packages/skills/release/append-audit-log";

const { values: args } = parseArgs({
  options: {
    bump: { type: "string", default: "auto" },
    scope: { type: "string", default: "*" },
    reason: { type: "string", default: "Manual trigger via CLI" },
    "dry-run": { type: "boolean", default: false },
    "since-ref": { type: "string" },
  },
});

const AGENT_NAME = "release-lead";
const AUDIT_LOG = ".orqenix/release-audit.log";

async function getLastReleaseTag(): Promise<string> {
  if (args["since-ref"]) return args["since-ref"];
  const { stdout } = await execa("git", [
    "describe",
    "--tags",
    "--match",
    "v*-phase-*",
    "--abbrev=0",
  ], { reject: false });
  return stdout.trim() || "HEAD~50";
}

async function detectMode(): Promise<"oss" | "pro"> {
  try {
    await import("node:fs/promises").then((fs) =>
      fs.access(".orqenix-pro/release-policy.yaml")
    );
    return "pro";
  } catch {
    return "oss";
  }
}

async function audit(action: string, inputs: Record<string, unknown>, outputs?: Record<string, unknown>, error?: string) {
  await auditLog.run({
    logPath: AUDIT_LOG,
    entry: {
      timestamp: new Date().toISOString(),
      agent: AGENT_NAME,
      action,
      inputs,
      outputs,
      error,
    },
  });
}

async function main(): Promise<void> {
  console.log("Orqenix release-lead agent");
  console.log(`Bump: ${args.bump} | Reason: ${args.reason} | Dry-run: ${args["dry-run"]}`);

  const mode = await detectMode();
  const policyPath = mode === "pro" ? ".orqenix-pro/release-policy.yaml" : ".orqenix/release-policy.yaml";
  const policy = parseYaml(await readFile(policyPath, "utf-8"));

  await audit("agent-start", { args, mode, policyPath });

  const sinceRef = await getLastReleaseTag();
  console.log(`\nStep 1: Detect changes since ${sinceRef}`);
  const detected = await detectChanged.run({ sinceRef, packagesGlob: "packages/*" });
  console.log(`  Found ${detected.changedPackages.length} changed packages`);
  await audit("detect-changed-packages", { sinceRef }, { count: detected.changedPackages.length });

  if (detected.changedPackages.length === 0) {
    console.log("\nNothing to release.");
    await audit("agent-stop", { reason: "nothing-to-release" });
    process.exit(0);
  }

  console.log("\nStep 2: Classify changes");
  const classifications = await classify.run({
    sinceRef,
    packageNames: detected.changedPackages.map((p) => p.name),
    packagesPaths: detected.changedPackages.map((p) => p.path),
  });
  await audit("classify-changes", { sinceRef }, { count: classifications.length });

  console.log("\nStep 3: Propose bumps");
  const proposals = await proposeBump.run({
    classifications,
    policyPath,
    forceBump: args.bump === "auto" ? undefined : (args.bump as "major" | "minor" | "patch"),
  });
  for (const p of proposals) {
    console.log(`  ${p.package}: ${p.bump} (${p.reason})`);
  }
  await audit("propose-bump", { forceBump: args.bump }, { proposals });

  if (proposals.length === 0) {
    console.log("\nNo packages need bumping.");
    await audit("agent-stop", { reason: "no-bumps-needed" });
    process.exit(0);
  }

  console.log("\nStep 4: Generate changeset");
  const changeset = await generateChangeset.run({
    proposals,
    classifications,
    summary: args.reason,
    changesetDir: ".changeset",
  });
  console.log(`  Created ${changeset.fileName}`);
  await audit("generate-changeset", {}, { fileName: changeset.fileName });

  if (args["dry-run"]) {
    console.log("\nDry-run complete. No branch/PR created.");
    await audit("agent-stop", { reason: "dry-run-complete" });
    process.exit(0);
  }

  const currentVersion = await getCurrentVersion();
  const newVersion = bumpVersion(currentVersion, getHighestBump(proposals));
  console.log(`\nNew version: ${newVersion}`);

  console.log("\nStep 5: Create release branch");
  const branch = await createBranch.run({
    version: newVersion,
    phaseNumber: 5,
    changesetPath: changeset.filePath,
  });
  console.log(`  Branch: ${branch.branchName} (${branch.commitSha.slice(0, 7)})`);
  await audit("create-release-branch", { version: newVersion }, branch);

  console.log("\nStep 6: Pre-publish-check");
  const { stdout: checkOutput } = await execa("pnpm", [
    "tsx",
    "scripts/pre-publish-check.ts",
    "--json-only",
  ]);
  const checkReport = JSON.parse(checkOutput);
  console.log(`  Verdict: ${checkReport.verdict}`);
  await audit("pre-publish-check", {}, { verdict: checkReport.verdict, blockers: checkReport.blockingFailures });

  if (checkReport.verdict === "no-go") {
    console.log("\nPre-publish check NO-GO. Stopping.");
    await audit("agent-stop", { reason: "pre-publish-no-go" });
    process.exit(1);
  }

  console.log("\nStep 7: Open PR");
  const pr = await openPR.run({
    branchName: branch.branchName,
    version: newVersion,
    proposals,
    verdict: checkReport.verdict,
    warnings: checkReport.results.filter((r: any) => r.status === "warn").map((r: any) => `[${r.id}] ${r.message}`),
    reason: args.reason,
  });
  console.log(`  PR: ${pr.prUrl}`);
  await audit("open-release-pr", { version: newVersion }, { prNumber: pr.prNumber, prUrl: pr.prUrl });

  console.log("\n" + "=".repeat(70));
  console.log(`:check: Release proposal ready: ${pr.prUrl}`);
  console.log(`   Review and merge to trigger publish.`);
  console.log("=".repeat(70));

  await audit("agent-stop", { reason: "success", prNumber: pr.prNumber });
}

async function getCurrentVersion(): Promise<string> {
  const pkg = JSON.parse(await readFile("packages/core/package.json", "utf-8"));
  return pkg.version;
}

function getHighestBump(proposals: { bump: string }[]): "major" | "minor" | "patch" {
  if (proposals.some((p) => p.bump === "major")) return "major";
  if (proposals.some((p) => p.bump === "minor")) return "minor";
  return "patch";
}

function bumpVersion(current: string, bump: "major" | "minor" | "patch"): string {
  const cleaned = current.split("-")[0];
  const [major, minor, patch] = cleaned.split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  await audit("agent-error", {}, undefined, (err as Error).message);
  process.exit(2);
});
