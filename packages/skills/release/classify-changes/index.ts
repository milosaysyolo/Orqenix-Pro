/**
 * Skill: classify-changes
 *
 * Read git log since ref and classify each commit per package.
 * Returns aggregated classification per package.
 */

import { execa } from "execa";

export type ChangeKind = "feat" | "fix" | "docs" | "chore" | "refactor" | "test" | "breaking" | "unknown";

export interface ClassifyInput {
  sinceRef: string;
  packageNames: string[];
  packagesPaths: string[];
}

export interface PackageClassification {
  package: string;
  highestKind: ChangeKind;
  commits: Array<{
    sha: string;
    title: string;
    kind: ChangeKind;
    isBreaking: boolean;
  }>;
}

const CONVENTIONAL_RE = /^(feat|fix|docs|chore|refactor|test|perf|build|ci|style|revert)(\([^)]+\))?(!)?: (.+)$/;
const BREAKING_FOOTER_RE = /(?:^|\n)BREAKING CHANGE:/;

function classifyCommit(title: string, body: string): { kind: ChangeKind; isBreaking: boolean } {
  const match = title.match(CONVENTIONAL_RE);
  if (!match) {
    return { kind: "unknown", isBreaking: false };
  }
  const [, type, , bang] = match;
  const isBreaking = bang === "!" || BREAKING_FOOTER_RE.test(body);
  return {
    kind: isBreaking ? "breaking" : (type as ChangeKind),
    isBreaking,
  };
}

const KIND_PRIORITY: Record<ChangeKind, number> = {
  breaking: 100,
  feat: 50,
  fix: 30,
  refactor: 20,
  perf: 20,
  test: 10,
  docs: 5,
  chore: 5,
  unknown: 0,
};

export async function run(input: ClassifyInput): Promise<PackageClassification[]> {
  const results: PackageClassification[] = [];

  for (let i = 0; i < input.packageNames.length; i++) {
    const pkgName = input.packageNames[i];
    const pkgPath = input.packagesPaths[i];

    const { stdout } = await execa("git", [
      "log",
      `${input.sinceRef}...HEAD`,
      "--pretty=format:%H%n%s%n%b%n---END---",
      "--",
      pkgPath,
    ]);

    const commits: PackageClassification["commits"] = [];
    const entries = stdout.split("---END---").filter((e) => e.trim().length > 0);

    for (const entry of entries) {
      const lines = entry.trim().split("\n");
      const sha = lines[0];
      const title = lines[1] ?? "";
      const body = lines.slice(2).join("\n");
      const { kind, isBreaking } = classifyCommit(title, body);
      commits.push({ sha: sha.slice(0, 7), title, kind, isBreaking });
    }

    const highestKind = commits.reduce<ChangeKind>(
      (acc, c) => (KIND_PRIORITY[c.kind] > KIND_PRIORITY[acc] ? c.kind : acc),
      "unknown"
    );

    results.push({
      package: pkgName,
      highestKind,
      commits,
    });
  }

  return results;
}
