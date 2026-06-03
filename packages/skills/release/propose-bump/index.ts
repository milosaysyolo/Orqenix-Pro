/**
 * Skill: propose-bump
 *
 * Apply semver rules from release-policy.yaml to propose bump type per package.
 * Respects fixed_version_group (all @orqenix/* bump together).
 */

import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { ChangeKind, PackageClassification } from "../classify-changes";

export type BumpType = "major" | "minor" | "patch" | "none";

export interface ProposeBumpInput {
  classifications: PackageClassification[];
  policyPath: string;
  forceBump?: BumpType;
}

export interface BumpProposal {
  package: string;
  bump: BumpType;
  reason: string;
}

const KIND_TO_BUMP: Record<ChangeKind, BumpType> = {
  breaking: "major",
  feat: "minor",
  fix: "patch",
  refactor: "patch",
  perf: "patch",
  test: "none",
  docs: "none",
  chore: "none",
  unknown: "none",
};

const BUMP_PRIORITY: Record<BumpType, number> = {
  major: 3,
  minor: 2,
  patch: 1,
  none: 0,
};

function maxBump(a: BumpType, b: BumpType): BumpType {
  return BUMP_PRIORITY[a] >= BUMP_PRIORITY[b] ? a : b;
}

export async function run(input: ProposeBumpInput): Promise<BumpProposal[]> {
  const policy = parseYaml(await readFile(input.policyPath, "utf-8"));
  const fixedGroups: string[][] = policy.policy.fixed_version_group ?? [];

  const proposals = new Map<string, BumpProposal>();
  for (const cl of input.classifications) {
    const bump = input.forceBump ?? KIND_TO_BUMP[cl.highestKind];
    proposals.set(cl.package, {
      package: cl.package,
      bump,
      reason: `Highest commit kind: ${cl.highestKind}`,
    });
  }

  for (const group of fixedGroups) {
    const pattern = group[0];
    const matcher = new RegExp("^" + pattern.replace("*", ".+") + "$");

    let highestInGroup: BumpType = "none";
    for (const [, prop] of proposals) {
      if (matcher.test(prop.package)) {
        highestInGroup = maxBump(highestInGroup, prop.bump);
      }
    }

    for (const [, prop] of proposals) {
      if (matcher.test(prop.package) && BUMP_PRIORITY[prop.bump] < BUMP_PRIORITY[highestInGroup]) {
        prop.bump = highestInGroup;
        prop.reason = `Fixed group ${pattern} bumped to ${highestInGroup}`;
      }
    }
  }

  return Array.from(proposals.values()).filter((p) => p.bump !== "none");
}
