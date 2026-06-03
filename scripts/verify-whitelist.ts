#!/usr/bin/env tsx
/**
 * Whitelist Verification Script
 *
 * Verifies that every package in publishable-whitelist.yaml:
 * 1. Has a corresponding directory under packages/
 * 2. Has a valid package.json
 * 3. Matches expected scope (@orqenix/* OR @orqenix-pro/*)
 * 4. Is NOT marked private:true
 * 5. Has all required files (LICENSE, README.md, CHANGELOG.md)
 * 6. Has buildable src/ structure
 *
 * Also reports:
 * - Packages in repo but NOT in whitelist (orphans)
 * - Packages in whitelist but NOT in repo (missing)
 * - Packages with publish blockers
 *
 * Usage:
 *   pnpm tsx scripts/verify-whitelist.ts                # text report
 *   pnpm tsx scripts/verify-whitelist.ts --json         # JSON output
 *   pnpm tsx scripts/verify-whitelist.ts --strict       # exit 1 on any warning
 *   pnpm tsx scripts/verify-whitelist.ts --mode=oss     # explicit mode
 */

import { readFile, readdir, stat, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";

type Mode = "oss" | "pro";
type Status = "ok" | "missing" | "private" | "wrong-scope" | "no-src" | "no-license" | "no-readme" | "no-changelog" | "invalid-json" | "no-package-json";

interface PackageVerification {
  name: string;
  expectedPath: string;
  exists: boolean;
  status: Status[];
  details: {
    actualName?: string;
    license?: string;
    private?: boolean;
    hasSrc?: boolean;
    hasLicense?: boolean;
    hasReadme?: boolean;
    hasChangelog?: boolean;
    files?: string[];
  };
}

interface WhitelistFile {
  version: number;
  mode: "whitelist" | "all";
  packages: string[];
  exclude?: string[];
}

interface VerifyReport {
  timestamp: string;
  mode: Mode;
  whitelist: {
    file: string;
    expectedCount: number;
  };
  packagesDir: string;
  verifiedPackages: PackageVerification[];
  orphans: string[];
  missing: string[];
  summary: {
    total: number;
    ok: number;
    withIssues: number;
    blockers: number;
  };
  verdict: "ready" | "warnings" | "blockers";
}

function parseArguments() {
  const { values } = parseArgs({
    options: {
      json: { type: "boolean", default: false },
      strict: { type: "boolean", default: false },
      mode: { type: "string" },
    },
  });
  return {
    json: values.json ?? false,
    strict: values.strict ?? false,
    mode: (values.mode as Mode | undefined),
  };
}

async function detectMode(): Promise<Mode> {
  try {
    await access(".orqenix-pro/publishable-whitelist.yaml", constants.F_OK);
    return "pro";
  } catch {}
  try {
    await access(".orqenix/publishable-whitelist.yaml", constants.F_OK);
    return "oss";
  } catch {}
  throw new Error("No publishable-whitelist.yaml found in .orqenix/ or .orqenix-pro/");
}

async function loadWhitelist(mode: Mode): Promise<WhitelistFile> {
  const path = mode === "pro"
    ? ".orqenix-pro/publishable-whitelist.yaml"
    : ".orqenix/publishable-whitelist.yaml";
  const content = await readFile(path, "utf-8");
  const parsed = parseYaml(content) as WhitelistFile;
  if (!parsed.packages || !Array.isArray(parsed.packages)) {
    throw new Error(`Invalid whitelist file: missing 'packages' array`);
  }
  return parsed;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

function packageNameToDir(name: string): string {
  const parts = name.split("/");
  return parts[parts.length - 1] ?? name;
}

function expectedScope(mode: Mode): string {
  return mode === "pro" ? "@orqenix-pro/" : "@orqenix/";
}

async function verifyPackage(pkgName: string, mode: Mode): Promise<PackageVerification> {
  const dirName = packageNameToDir(pkgName);
  const expectedPath = join("packages", dirName);
  const verification: PackageVerification = {
    name: pkgName,
    expectedPath,
    exists: false,
    status: [],
    details: {},
  };

  if (!(await dirExists(expectedPath))) {
    verification.status.push("missing");
    return verification;
  }
  verification.exists = true;

  const pkgJsonPath = join(expectedPath, "package.json");
  if (!(await fileExists(pkgJsonPath))) {
    verification.status.push("no-package-json");
    return verification;
  }

  let pkgJson: Record<string, unknown>;
  try {
    pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf-8"));
  } catch {
    verification.status.push("invalid-json");
    return verification;
  }

  verification.details.actualName = pkgJson.name as string;
  const expectedPrefix = expectedScope(mode);
  if (typeof pkgJson.name !== "string" || !pkgJson.name.startsWith(expectedPrefix)) {
    verification.status.push("wrong-scope");
  }
  if (pkgJson.name !== pkgName) {
    verification.status.push("wrong-scope");
  }

  verification.details.private = pkgJson.private === true;
  if (pkgJson.private === true) {
    verification.status.push("private");
  }

  verification.details.license = pkgJson.license as string;
  verification.details.hasLicense = await fileExists(join(expectedPath, "LICENSE"));
  verification.details.hasReadme = await fileExists(join(expectedPath, "README.md"));
  verification.details.hasChangelog = await fileExists(join(expectedPath, "CHANGELOG.md"));
  verification.details.hasSrc = await dirExists(join(expectedPath, "src"));

  if (!verification.details.hasLicense) verification.status.push("no-license");
  if (!verification.details.hasReadme) verification.status.push("no-readme");
  if (!verification.details.hasChangelog) verification.status.push("no-changelog");
  if (!verification.details.hasSrc) verification.status.push("no-src");

  if (verification.status.length === 0) {
    verification.status.push("ok");
  }

  return verification;
}

async function findOrphans(whitelist: string[], mode: Mode): Promise<string[]> {
  const orphans: string[] = [];
  const whitelistDirs = new Set(whitelist.map(packageNameToDir));
  const entries = await readdir("packages");

  for (const entry of entries) {
    if (whitelistDirs.has(entry)) continue;
    if (entry.startsWith("_")) continue;
    if (!(await dirExists(join("packages", entry)))) continue;

    const pkgJsonPath = join("packages", entry, "package.json");
    if (!(await fileExists(pkgJsonPath))) continue;

    try {
      const pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf-8"));
      const prefix = expectedScope(mode);
      if (
        typeof pkgJson.name === "string" &&
        pkgJson.name.startsWith(prefix) &&
        pkgJson.private !== true
      ) {
        orphans.push(pkgJson.name);
      }
    } catch {
      continue;
    }
  }

  return orphans;
}

function isBlocker(status: Status[]): boolean {
  const blockerStatuses: Status[] = ["missing", "wrong-scope", "no-src", "invalid-json", "no-package-json"];
  return status.some((s) => blockerStatuses.includes(s));
}

function printTextReport(report: VerifyReport): void {
  const icon = { ready: ":green:", warnings: ":yellow:", blockers: ":red:" }[report.verdict];

  console.log("");
  console.log("=".repeat(70));
  console.log(`Orqenix Whitelist Verification (mode: ${report.mode})`);
  console.log(`Verdict: ${icon} ${report.verdict.toUpperCase()}`);
  console.log("=".repeat(70));
  console.log("");
  console.log(`Whitelist: ${report.whitelist.file}`);
  console.log(`Expected packages: ${report.whitelist.expectedCount}`);
  console.log("");
  console.log("Summary:");
  console.log(`  :check: OK:        ${report.summary.ok}`);
  console.log(`  :warning: Warnings:  ${report.summary.withIssues - report.summary.blockers}`);
  console.log(`  :x: Blockers:  ${report.summary.blockers}`);
  console.log("");

  console.log("Package Details:");
  for (const pkg of report.verifiedPackages) {
    const statusIcon =
      pkg.status.includes("ok") ? ":check:" :
      isBlocker(pkg.status) ? ":x:" : ":warning:";
    const statusStr = pkg.status.filter((s) => s !== "ok").join(", ");
    console.log(`  ${statusIcon} ${pkg.name.padEnd(50)} ${statusStr}`);
  }

  if (report.orphans.length > 0) {
    console.log("");
    console.log(`Orphan packages (in packages/ but NOT in whitelist): ${report.orphans.length}`);
    for (const o of report.orphans) {
      console.log(`  :white_circle: ${o}`);
    }
    console.log("");
    console.log("  Action: Either add to whitelist or mark as private:true in package.json");
  }

  if (report.missing.length > 0) {
    console.log("");
    console.log(`Missing packages (in whitelist but NOT in repo): ${report.missing.length}`);
    for (const m of report.missing) {
      console.log(`  :x: ${m}`);
    }
    console.log("");
    console.log("  Action: Either remove from whitelist or create the package");
  }

  console.log("");
  console.log("=".repeat(70));
  console.log(`Final Verdict: ${icon} ${report.verdict.toUpperCase()}`);
  console.log("=".repeat(70));
}

async function main(): Promise<void> {
  const args = parseArguments();
  const mode = args.mode ?? await detectMode();

  const whitelist = await loadWhitelist(mode);
  const whitelistPath = mode === "pro"
    ? ".orqenix-pro/publishable-whitelist.yaml"
    : ".orqenix/publishable-whitelist.yaml";

  const verifiedPackages: PackageVerification[] = [];
  for (const pkgName of whitelist.packages) {
    verifiedPackages.push(await verifyPackage(pkgName, mode));
  }

  const orphans = await findOrphans(whitelist.packages, mode);
  const missing = verifiedPackages
    .filter((p) => !p.exists)
    .map((p) => p.name);

  const ok = verifiedPackages.filter((p) => p.status.includes("ok")).length;
  const withIssues = verifiedPackages.length - ok;
  const blockers = verifiedPackages.filter((p) => isBlocker(p.status)).length;

  let verdict: VerifyReport["verdict"];
  if (blockers > 0 || missing.length > 0) verdict = "blockers";
  else if (withIssues > 0 || orphans.length > 0) verdict = "warnings";
  else verdict = "ready";

  const report: VerifyReport = {
    timestamp: new Date().toISOString(),
    mode,
    whitelist: {
      file: whitelistPath,
      expectedCount: whitelist.packages.length,
    },
    packagesDir: "packages",
    verifiedPackages,
    orphans,
    missing,
    summary: {
      total: verifiedPackages.length,
      ok,
      withIssues,
      blockers,
    },
    verdict,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (verdict === "blockers") process.exit(1);
  if (verdict === "warnings" && args.strict) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
