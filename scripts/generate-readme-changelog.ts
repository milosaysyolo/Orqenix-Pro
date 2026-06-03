#!/usr/bin/env tsx
/**
 * Generate README.md and CHANGELOG.md skeletons for packages missing them.
 * Existing files are NOT overwritten.
 */

import { readFile, writeFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

function readmeSkeleton(pkgName: string, description: string): string {
  return `# ${pkgName}

${description}

## Installation

\`\`\`bash
npm install ${pkgName}
# or
pnpm add ${pkgName}
\`\`\`

## Usage

\`\`\`typescript
import { /* exports */ } from "${pkgName}";
\`\`\`

## API

See https://orqenix.dev/docs/api for full documentation.

## License

See LICENSE file in package root.

## Links

- Homepage: https://orqenix.dev
- Repository: https://github.com/milosaysyolo/Orqenix
- Issues: https://github.com/milosaysyolo/Orqenix/issues
`;
}

const changelogSkeleton = `# Changelog

All notable changes to this package will be documented in this file.

The format is based on https://keepachangelog.com/en/1.1.0/,
and this project adheres to https://semver.org/spec/v2.0.0.html.

## [Unreleased]
`;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const packages = await readdir("packages");
  let readmeCreated = 0;
  let changelogCreated = 0;

  for (const pkg of packages) {
    const pkgPath = join("packages", pkg);
    const pkgJsonPath = join(pkgPath, "package.json");

    let pkgJson: { name?: string; description?: string };
    try {
      pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf-8"));
    } catch {
      continue;
    }

    if (!pkgJson.name) continue;

    const readmePath = join(pkgPath, "README.md");
    if (!(await fileExists(readmePath))) {
      await writeFile(readmePath, readmeSkeleton(pkgJson.name, pkgJson.description ?? ""));
      readmeCreated++;
    }

    const changelogPath = join(pkgPath, "CHANGELOG.md");
    if (!(await fileExists(changelogPath))) {
      await writeFile(changelogPath, changelogSkeleton);
      changelogCreated++;
    }
  }

  console.log(`Created ${readmeCreated} README files, ${changelogCreated} CHANGELOG files`);
}

main().catch(console.error);
