#!/usr/bin/env tsx
/**
 * Batch S3: Pre-publish Check Orchestrator
 *
 * Runs 24 deterministic checks in parallel, outputs JSON report.
 *
 * Usage:
 *   pnpm tsx scripts/pre-publish-check.ts              # human-readable
 *   pnpm tsx scripts/pre-publish-check.ts --json-only  # machine-readable
 *   pnpm tsx scripts/pre-publish-check.ts --check C09  # single check
 *   pnpm tsx scripts/pre-publish-check.ts --allow-warn # warnings don't fail
 */

import { parseArgs } from "node:util";
import { writeFile, readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { allChecks } from "./checks";
import type { Check, CheckResult, CheckContext, PrePublishReport } from "./checks/types";
import type { ReleasePolicy, PackageInfo } from "./types";
import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";

const { values: args } = parseArgs({
  options: {
    "json-only": { type: "boolean", default: false },
    check: { type: "string" },
    "allow-warn": { type: "boolean", default: false },
    mode: { type: "string" },
  },
});

async function discoverPackages(): Promise<PackageInfo[]> {
  const packagesDir = "packages";
  const entries = await readdir(packagesDir);
  const packages: PackageInfo[] = [];
  const config = detectConfig(detectMode());

  for (const entry of entries) {
    const path = join(packagesDir, entry);
    const pkgJsonPath = join(path, "package.json");
    try {
      const stat_ = await stat(pkgJsonPath);
      if (!stat_.isFile()) continue;
      const content = JSON.parse(await readFile(pkgJsonPath, "utf-8"));
      const info: PackageInfo = {
        name: content.name ?? `<unnamed:${entry}>`,
        path,
        pkgJsonPath,
        current: content,
        classification: classify(content, config),
      };
      packages.push(info);
    } catch {
      // No package.json, skip
    }
  }
  return packages;
}

interface DetectConfig {
  scopePrefix: string;
  forbiddenScopes: string[];
}

function detectConfig(mode: "oss" | "pro"): DetectConfig {
  if (mode === "pro") {
    return { scopePrefix: "@orqenix-pro/", forbiddenScopes: ["@orqenix/", "@orqenix-cloud/"] };
  }
  return { scopePrefix: "@orqenix/", forbiddenScopes: ["@orqenix-pro/", "@orqenix-cloud/"] };
}

function classify(pkg: Record<string, unknown>, config: DetectConfig): "publishable" | "internal" | "skip" {
  if (pkg.private === true) return "internal";
  if (pkg.doNotPublish === true) return "skip";
  if (typeof pkg.name !== "string") return "skip";
  if (!pkg.name.startsWith(config.scopePrefix)) return "skip";
  for (const forbidden of config.forbiddenScopes) {
    if (pkg.name.startsWith(forbidden)) return "skip";
  }
  return "publishable";
}

async function loadContext(): Promise<CheckContext> {
  const mode = (args.mode as "oss" | "pro") ?? detectMode();
  const policyPath = mode === "pro"
    ? ".orqenix-pro/release-policy.yaml"
    : ".orqenix/release-policy.yaml";

  const policy = parseYaml(await readFile(policyPath, "utf-8")) as ReleasePolicy;
  const packages = await discoverPackages();
  const publishable = packages.filter((p) => p.classification === "publishable");

  return {
    repoRoot: process.cwd(),
    mode,
    policy,
    packages,
    publishableNames: publishable.map((p) => p.name),
    env: process.env,
  };
}

function buildReport(results: CheckResult[], ctx: CheckContext, totalMs: number): PrePublishReport {
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const blockingFailures = results.filter((r) => r.status === "fail" && r.severity === "blocking").length;

  let verdict: PrePublishReport["verdict"];
  if (blockingFailures > 0) verdict = "no-go";
  else if (warned > 0) verdict = "go-with-warnings";
  else verdict = "go";

  return {
    timestamp: new Date().toISOString(),
    mode: ctx.mode,
    repo: process.cwd(),
    totalChecks: results.length,
    passed,
    failed,
    warned,
    skipped,
    durationMs: totalMs,
    blockingFailures,
    results,
    verdict,
  };
}

function printHumanReport(report: PrePublishReport): void {
  console.log("");
  console.log("=".repeat(70));
  console.log(`Orqenix Pre-Publish Check Report`);
  console.log(`Mode: ${report.mode} | Verdict: ${verdictBadge(report.verdict)}`);
  console.log(`Duration: ${report.durationMs}ms | Checks: ${report.totalChecks}`);
  console.log("=".repeat(70));

  for (const r of report.results) {
    const icon = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" }[r.status];
    const sev = r.severity === "blocking" ? "BLK" : r.severity === "warning" ? "WRN" : "INF";
    console.log(`[${icon}] [${r.id}] [${sev}] ${r.message}`);
    if (r.details?.recommendation) {
      console.log(`     -> ${r.details.recommendation}`);
    }
    if (r.details?.affectedPackages && r.details.affectedPackages.length > 0) {
      const preview = r.details.affectedPackages.slice(0, 5).join(", ");
      const rest = r.details.affectedPackages.length > 5 ? ` (+${r.details.affectedPackages.length - 5} more)` : "";
      console.log(`     packages: ${preview}${rest}`);
    }
  }

  console.log("");
  console.log("=".repeat(70));
  console.log(`Summary: ${report.passed} pass | ${report.failed} fail | ${report.warned} warn | ${report.skipped} skip`);
  console.log(`Verdict: ${verdictBadge(report.verdict)}`);
  console.log("=".repeat(70));
}

function verdictBadge(v: PrePublishReport["verdict"]): string {
  return { go: "GO", "go-with-warnings": "GO (with warnings)", "no-go": "NO-GO" }[v];
}

function detectMode(): "oss" | "pro" {
  try {
    const pkg = JSON.parse(require("node:fs").readFileSync(`${process.cwd()}/package.json`, "utf-8"));
    if (pkg.name?.includes("pro")) return "pro";
  } catch {}
  return "oss";
}

async function runChecks(checks: Check[], ctx: CheckContext): Promise<CheckResult[]> {
  const CONCURRENCY = 8;
  const results: CheckResult[] = [];

  for (let i = 0; i < checks.length; i += CONCURRENCY) {
    const batch = checks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (check) => {
        try {
          return await check.run(ctx);
        } catch (err) {
          return {
            id: check.id,
            severity: check.severity,
            status: "fail" as const,
            durationMs: 0,
            message: `Check threw: ${(err as Error).message}`,
          };
        }
      })
    );
    results.push(...batchResults);
  }

  return results;
}

async function main(): Promise<void> {
  const start = Date.now();
  const ctx = await loadContext();

  let checksToRun: Check[] = allChecks;
  if (args.check) {
    checksToRun = allChecks.filter((c) => c.id === args.check);
    if (checksToRun.length === 0) {
      console.error(`Check not found: ${args.check}`);
      console.error(`Available: ${allChecks.map((c) => c.id).join(", ")}`);
      process.exit(2);
    }
  }

  const results = await runChecks(checksToRun, ctx);
  const report = buildReport(results, ctx, Date.now() - start);

  const reportDir = ctx.mode === "pro" ? ".orqenix-pro" : ".orqenix";
  await writeFile(
    join(reportDir, "pre-publish-report.json"),
    JSON.stringify(report, null, 2)
  );

  if (args["json-only"]) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  if (report.blockingFailures > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
