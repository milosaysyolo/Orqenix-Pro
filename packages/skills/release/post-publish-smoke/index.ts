/**
 * Skill: post-publish-smoke
 *
 * Verify published packages on npm after release.
 */

import { execa } from "execa";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface SmokeCheckInput {
  packages: Array<{ name: string; version: string }>;
  smokeTestCode?: string;
}

export interface PackageSmokeResult {
  package: string;
  version: string;
  npmViewOk: boolean;
  installedOk: boolean;
  requireOk: boolean;
  error?: string;
}

export interface SmokeCheckOutput {
  allOk: boolean;
  results: PackageSmokeResult[];
}

export async function run(input: SmokeCheckInput): Promise<SmokeCheckOutput> {
  const results: PackageSmokeResult[] = [];

  for (const pkg of input.packages) {
    const result: PackageSmokeResult = {
      package: pkg.name,
      version: pkg.version,
      npmViewOk: false,
      installedOk: false,
      requireOk: false,
    };

    try {
      const { stdout } = await execa("npm", ["view", `${pkg.name}@${pkg.version}`, "version"]);
      result.npmViewOk = stdout.trim() === pkg.version;
    } catch (err) {
      result.error = `npm view failed: ${(err as Error).message}`;
      results.push(result);
      continue;
    }

    const tmpDir = await mkdtemp(join(tmpdir(), "smoke-"));
    try {
      await writeFile(join(tmpDir, "package.json"), JSON.stringify({ name: "smoke-test", private: true }));
      await execa("npm", ["install", `${pkg.name}@${pkg.version}`, "--no-fund", "--no-audit"], { cwd: tmpDir });
      result.installedOk = true;

      try {
        await execa("node", ["-e", `require('${pkg.name}'); console.log('OK')`], { cwd: tmpDir });
        result.requireOk = true;
      } catch {
        result.requireOk = false;
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }

    results.push(result);
  }

  return {
    allOk: results.every((r) => r.npmViewOk && r.installedOk && r.requireOk),
    results,
  };
}
