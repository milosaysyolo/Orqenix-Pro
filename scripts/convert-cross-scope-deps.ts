#!/usr/bin/env tsx
/**
 * Batch S4: Cross-Scope Dependency Converter
 *
 * Converts workspace:* and workspace:^ specs for cross-scope deps to version
 * ranges before publishing the Pro repo to npm.
 *
 * Why: workspace: protocol only resolves within a single pnpm workspace.
 * When publishing Pro packages that depend on OSS packages, deps must point
 * to versions actually on npm.
 *
 * Usage:
 *   pnpm tsx scripts/convert-cross-scope-deps.ts                          # dry-run
 *   pnpm tsx scripts/convert-cross-scope-deps.ts --apply                  # write
 *   pnpm tsx scripts/convert-cross-scope-deps.ts --oss-version=0.5.0      # explicit version
 *   pnpm tsx scripts/convert-cross-scope-deps.ts --version-range='~'      # use ~ instead of ^
 */

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

interface CliArgs {
  apply: boolean;
  ossVersion?: string;
  versionRange: string;
}

interface Conversion {
  pkg: string;
  pkgPath: string;
  section: "dependencies" | "peerDependencies";
  dep: string;
  from: string;
  to: string;
}

const CROSS_SCOPE_PREFIX = "@orqenix/";
const SAME_SCOPE_PREFIX = "@orqenix-pro/";
const NPM_REGISTRY = "https://registry.npmjs.org";

function parseArguments(): CliArgs {
  const { values } = parseArgs({
    options: {
      apply: { type: "boolean", default: false },
      "oss-version": { type: "string" },
      "version-range": { type: "string", default: "^" },
    },
  });
  return {
    apply: values.apply ?? false,
    ossVersion: values["oss-version"],
    versionRange: values["version-range"] ?? "^",
  };
}

async function fetchLatestVersion(pkg: string): Promise<string> {
  const encoded = encodeURIComponent(pkg);
  const res = await fetch(`${NPM_REGISTRY}/${encoded}/latest`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${pkg}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { version: string };
  return data.version;
}

async function isPackageDir(path: string): Promise<boolean> {
  try {
    const s = await stat(join(path, "package.json"));
    return s.isFile();
  } catch {
    return false;
  }
}

async function convertPackage(
  pkgPath: string,
  args: CliArgs,
  versionCache: Map<string, string>
): Promise<Conversion[]> {
  const pkgJsonPath = join(pkgPath, "package.json");
  const raw = await readFile(pkgJsonPath, "utf-8");
  const content = JSON.parse(raw) as Record<string, unknown>;
  const conversions: Conversion[] = [];

  const sections = ["dependencies", "peerDependencies"] as const;
  for (const section of sections) {
    const deps = content[section] as Record<string, string> | undefined;
    if (!deps) continue;

    for (const [dep, spec] of Object.entries(deps)) {
      if (!spec.startsWith("workspace:")) continue;
      if (!dep.startsWith(CROSS_SCOPE_PREFIX)) continue;
      if (dep.startsWith(SAME_SCOPE_PREFIX)) continue;

      let targetVersion: string;
      if (args.ossVersion) {
        targetVersion = args.ossVersion;
      } else {
        if (!versionCache.has(dep)) {
          versionCache.set(dep, await fetchLatestVersion(dep));
        }
        targetVersion = versionCache.get(dep)!;
      }

      const newSpec = `${args.versionRange}${targetVersion}`;
      conversions.push({
        pkg: content.name as string,
        pkgPath,
        section,
        dep,
        from: spec,
        to: newSpec,
      });

      if (args.apply) {
        deps[dep] = newSpec;
      }
    }
  }

  if (args.apply && conversions.length > 0) {
    await writeFile(pkgJsonPath, JSON.stringify(content, null, 2) + "\n", "utf-8");
  }

  return conversions;
}

async function main(): Promise<void> {
  const args = parseArguments();

  console.log("Orqenix Cross-Scope Dep Converter");
  console.log(`  Apply: ${args.apply}`);
  console.log(`  Version range prefix: ${args.versionRange}`);
  if (args.ossVersion) {
    console.log(`  Target OSS version: ${args.ossVersion}`);
  } else {
    console.log(`  Will query npm registry for @orqenix/* latest versions`);
  }
  console.log();

  const packagesDir = "packages";
  const entries = await readdir(packagesDir);
  const allConversions: Conversion[] = [];
  const versionCache = new Map<string, string>();
  const errors: Array<{ pkg: string; error: string }> = [];

  for (const entry of entries) {
    const pkgPath = join(packagesDir, entry);
    if (!(await isPackageDir(pkgPath))) continue;

    try {
      const conversions = await convertPackage(pkgPath, args, versionCache);
      allConversions.push(...conversions);
    } catch (err) {
      errors.push({ pkg: entry, error: (err as Error).message });
    }
  }

  // Summary
  if (allConversions.length === 0) {
    console.log("No cross-scope workspace: deps found to convert");
  } else {
    console.log(`${allConversions.length} conversion(s):`);
    const byPkg = new Map<string, Conversion[]>();
    for (const c of allConversions) {
      if (!byPkg.has(c.pkg)) byPkg.set(c.pkg, []);
      byPkg.get(c.pkg)!.push(c);
    }
    for (const [pkg, convs] of byPkg) {
      console.log(`\n  ${pkg}:`);
      for (const c of convs) {
        console.log(`    ${c.section}.${c.dep}: ${c.from} -> ${c.to}`);
      }
    }
  }

  if (errors.length > 0) {
    console.log(`\n${errors.length} error(s):`);
    for (const e of errors) {
      console.log(`  ${e.pkg}: ${e.error}`);
    }
  }

  if (!args.apply) {
    console.log("\nDRY RUN. Re-run with --apply to write changes.");
  } else {
    console.log("\nChanges applied. Run `pnpm install` to update lockfile.");
  }

  if (errors.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
