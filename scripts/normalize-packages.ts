#!/usr/bin/env tsx
/**
 * Batch S2: Package Metadata Normalizer
 *
 * Discovers all packages, normalizes package.json to publish-ready state.
 * Idempotent: running multiple times produces same result.
 *
 * Usage:
 *   pnpm tsx scripts/normalize-packages.ts            # dry-run
 *   pnpm tsx scripts/normalize-packages.ts --apply    # actually write
 *   pnpm tsx scripts/normalize-packages.ts --report   # write discovery report only
 */

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";

type RepoMode = "oss" | "pro";

interface PackageInfo {
  name: string;
  path: string;
  pkgJsonPath: string;
  current: Record<string, unknown>;
  classification: "publishable" | "internal" | "skip";
  reason?: string;
}

interface NormalizeResult {
  package: string;
  status: "normalized" | "skipped" | "error";
  changesApplied: string[];
  warnings: string[];
}

const { values: args } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    report: { type: "boolean", default: false },
    mode: { type: "string" },
  },
});

const MODE: RepoMode = (args.mode as RepoMode) ?? detectMode();
const APPLY = args.apply ?? false;

function detectMode(): RepoMode {
  try {
    const policyPath = ".orqenix/release-policy.yaml";
    return "oss";
  } catch {
    return "pro";
  }
}

const CONFIG = {
  oss: {
    scopePrefix: "@orqenix/",
    forbiddenScopes: ["@orqenix-pro/", "@orqenix-cloud/"],
    license: "Apache-2.0",
    repo: "milosaysyolo/Orqenix",
    homepage: "https://orqenix.dev",
    bugsUrl: "https://github.com/milosaysyolo/Orqenix/issues",
  },
  pro: {
    scopePrefix: "@orqenix-pro/",
    forbiddenScopes: ["@orqenix/", "@orqenix-cloud/"],
    license: "BUSL-1.1",
    repo: "milosaysyolo/Orqenix-Pro",
    homepage: "https://orqenix.dev",
    bugsUrl: "https://github.com/milosaysyolo/Orqenix-Pro/issues",
  },
}[MODE];

async function discoverPackages(): Promise<PackageInfo[]> {
  const packagesDir = "packages";
  const entries = await readdir(packagesDir);
  const packages: PackageInfo[] = [];

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
        classification: classify(content),
      };
      packages.push(info);
    } catch {
      // No package.json, skip
    }
  }

  return packages;
}

function classify(pkg: Record<string, unknown>): "publishable" | "internal" | "skip" {
  if (pkg.private === true) return "internal";
  if (pkg.doNotPublish === true) return "skip";
  if (typeof pkg.name !== "string") return "skip";
  if (!pkg.name.startsWith(CONFIG.scopePrefix)) return "skip";
  for (const forbidden of CONFIG.forbiddenScopes) {
    if (pkg.name.startsWith(forbidden)) return "skip";
  }
  return "publishable";
}

function normalize(pkg: PackageInfo): { content: Record<string, unknown>; changes: string[]; warnings: string[] } {
  const pkgName = basename(pkg.path);
  const current = pkg.current;
  const changes: string[] = [];
  const warnings: string[] = [];

  const normalized: Record<string, unknown> = { ...current };

  const requiredFields: Array<[string, unknown]> = [
    ["name", current.name],
    ["version", current.version ?? "0.5.0-phase-5"],
    ["description", current.description ?? `Orqenix ${pkgName} package`],
    ["license", CONFIG.license],
    ["homepage", CONFIG.homepage],
    ["type", "module"],
    ["main", "./dist/index.cjs"],
    ["module", "./dist/index.js"],
    ["types", "./dist/index.d.ts"],
    ["sideEffects", false],
  ];

  for (const [field, defaultValue] of requiredFields) {
    if (normalized[field] === undefined || normalized[field] === null) {
      normalized[field] = defaultValue;
      changes.push(`Added field: ${field}`);
    }
  }

  if (current.license !== CONFIG.license) {
    if (current.license) {
      warnings.push(`License changed from ${current.license} to ${CONFIG.license}`);
    }
    normalized.license = CONFIG.license;
    changes.push(`Set license: ${CONFIG.license}`);
  }

  if (typeof current.author !== "object" || current.author === null) {
    normalized.author = {
      name: "Milo Nguyen",
      email: "milo@orqenix.dev",
      url: "https://orqenix.dev",
    };
    changes.push("Set author object");
  }

  if (typeof current.repository !== "object" || current.repository === null) {
    normalized.repository = {
      type: "git",
      url: `git+https://github.com/${CONFIG.repo}.git`,
      directory: pkg.path,
    };
    changes.push("Set repository");
  } else {
    const repo = current.repository as Record<string, unknown>;
    if (repo.directory !== pkg.path) {
      normalized.repository = { ...repo, directory: pkg.path };
      changes.push("Updated repository.directory");
    }
  }

  if (typeof current.bugs !== "object" || current.bugs === null) {
    normalized.bugs = { url: CONFIG.bugsUrl };
    changes.push("Set bugs.url");
  }

  const baseKeywords = ["orqenix", "ai-agents"];
  const currentKeywords = Array.isArray(current.keywords) ? current.keywords : [];
  const mergedKeywords = Array.from(new Set([...baseKeywords, ...currentKeywords, deriveKeyword(pkgName)]));
  if (JSON.stringify(currentKeywords) !== JSON.stringify(mergedKeywords)) {
    normalized.keywords = mergedKeywords;
    changes.push(`Updated keywords: ${mergedKeywords.join(", ")}`);
  }

  const exportsMap = {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
      require: "./dist/index.cjs",
    },
    "./package.json": "./package.json",
  };
  if (JSON.stringify(current.exports) !== JSON.stringify(exportsMap)) {
    normalized.exports = exportsMap;
    changes.push("Set exports map (ESM + CJS dual)");
  }

  const filesList = ["dist", "README.md", "LICENSE", "CHANGELOG.md"];
  if (JSON.stringify(current.files) !== JSON.stringify(filesList)) {
    normalized.files = filesList;
    changes.push("Set files whitelist");
  }

  const publishConfig = {
    access: "public",
    registry: "https://registry.npmjs.org/",
    provenance: true,
  };
  if (JSON.stringify(current.publishConfig) !== JSON.stringify(publishConfig)) {
    normalized.publishConfig = publishConfig;
    changes.push("Set publishConfig (access=public, provenance=true)");
  }

  const engines = { node: ">=20.0.0" };
  if (JSON.stringify(current.engines) !== JSON.stringify(engines)) {
    normalized.engines = engines;
    changes.push("Set engines.node >=20.0.0");
  }

  const requiredScripts: Record<string, string> = {
    build: "tsup",
    test: "vitest run",
    typecheck: "tsc --noEmit",
    clean: "rm -rf dist",
    prepublishOnly: "pnpm clean && pnpm build && pnpm test",
  };
  const currentScripts = (current.scripts as Record<string, string>) ?? {};
  const mergedScripts = { ...requiredScripts, ...currentScripts };
  if (JSON.stringify(currentScripts) !== JSON.stringify(mergedScripts)) {
    normalized.scripts = mergedScripts;
    changes.push(`Merged ${Object.keys(requiredScripts).length} required scripts`);
  }

  const allDeps = {
    ...(current.dependencies as Record<string, string> ?? {}),
    ...(current.peerDependencies as Record<string, string> ?? {}),
  };
  for (const dep of Object.keys(allDeps)) {
    for (const forbidden of CONFIG.forbiddenScopes) {
      if (dep.startsWith(forbidden)) {
        warnings.push(`Cross-scope dependency detected: ${dep}. May cause publish failure.`);
      }
    }
  }

  return { content: normalized, changes, warnings };
}

function deriveKeyword(pkgName: string): string {
  if (pkgName.startsWith("kb-")) return "memory";
  if (pkgName.startsWith("mesh-")) return "mesh";
  if (pkgName.startsWith("storage-")) return "storage";
  if (pkgName.startsWith("plugin-")) return "plugin";
  if (pkgName === "cli") return "cli";
  if (pkgName === "core") return "core";
  return "orchestration";
}

async function writePackageJson(path: string, content: Record<string, unknown>): Promise<void> {
  const ordered = orderFields(content);
  await writeFile(path, JSON.stringify(ordered, null, 2) + "\n", "utf-8");
}

function orderFields(pkg: Record<string, unknown>): Record<string, unknown> {
  const order = [
    "name", "version", "description", "license", "author", "homepage",
    "repository", "bugs", "keywords",
    "type", "main", "module", "types", "exports", "files", "sideEffects",
    "publishConfig", "engines",
    "scripts",
    "dependencies", "peerDependencies", "devDependencies",
    "publishable", "private",
  ];
  const result: Record<string, unknown> = {};
  for (const key of order) {
    if (pkg[key] !== undefined) result[key] = pkg[key];
  }
  for (const key of Object.keys(pkg)) {
    if (!(key in result)) result[key] = pkg[key];
  }
  return result;
}

async function main(): Promise<void> {
  console.log(`Orqenix Package Normalizer (mode: ${MODE}, apply: ${APPLY})`);

  const packages = await discoverPackages();
  const publishable = packages.filter((p) => p.classification === "publishable");

  console.log(`\nDiscovery: ${packages.length} total, ${publishable.length} publishable`);

  const reportPath = MODE === "pro"
    ? ".orqenix-pro/discovery-report.json"
    : ".orqenix/discovery-report.json";
  await writeFile(reportPath, JSON.stringify({
    mode: MODE,
    timestamp: new Date().toISOString(),
    total: packages.length,
    publishable: publishable.length,
    packages: packages.map((p) => ({
      name: p.name,
      path: p.path,
      classification: p.classification,
    })),
  }, null, 2));

  if (args.report) {
    console.log(`Report written to ${reportPath}`);
    return;
  }

  const results: NormalizeResult[] = [];
  for (const pkg of publishable) {
    try {
      const { content, changes, warnings } = normalize(pkg);
      if (APPLY) {
        await writePackageJson(pkg.pkgJsonPath, content);
      }
      results.push({
        package: pkg.name,
        status: changes.length > 0 ? "normalized" : "skipped",
        changesApplied: changes,
        warnings,
      });
    } catch (err) {
      results.push({
        package: pkg.name,
        status: "error",
        changesApplied: [],
        warnings: [(err as Error).message],
      });
    }
  }

  console.log("\n=== Summary ===");
  const normalized = results.filter((r) => r.status === "normalized").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;
  console.log(`Normalized: ${normalized}`);
  console.log(`Already compliant (skipped): ${skipped}`);
  console.log(`Errors: ${errors}`);

  const warnings = results.flatMap((r) => r.warnings);
  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (!APPLY) {
    console.log("\nDRY RUN. Re-run with --apply to write changes.");
  }

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
