/**
 * Skill: detect-changed-packages
 *
 * Detect which packages have file changes since a given git ref.
 */

import { execa } from "execa";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface DetectInput {
  sinceRef: string;
  packagesGlob: string;
}

export interface ChangedPackage {
  name: string;
  path: string;
  fileChangeCount: number;
  fileChanges: string[];
}

export interface DetectOutput {
  sinceRef: string;
  totalChangedFiles: number;
  changedPackages: ChangedPackage[];
}

export async function run(input: DetectInput): Promise<DetectOutput> {
  const { stdout } = await execa("git", [
    "diff",
    "--name-only",
    `${input.sinceRef}...HEAD`,
  ]);
  const files = stdout.split("\n").filter((f) => f.length > 0);

  const byPackage = new Map<string, ChangedPackage>();
  for (const file of files) {
    const match = file.match(/^packages\/([^/]+)\//);
    if (!match) continue;
    const dirName = match[1];
    const pkgPath = `packages/${dirName}`;

    if (!byPackage.has(dirName)) {
      try {
        const pkg = JSON.parse(
          await readFile(join(pkgPath, "package.json"), "utf-8")
        );
        byPackage.set(dirName, {
          name: pkg.name as string,
          path: pkgPath,
          fileChangeCount: 0,
          fileChanges: [],
        });
      } catch {
        continue;
      }
    }

    const entry = byPackage.get(dirName)!;
    entry.fileChangeCount++;
    entry.fileChanges.push(file);
  }

  return {
    sinceRef: input.sinceRef,
    totalChangedFiles: files.length,
    changedPackages: Array.from(byPackage.values()),
  };
}
