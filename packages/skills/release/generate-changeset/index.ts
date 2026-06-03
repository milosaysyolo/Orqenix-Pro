/**
 * Skill: generate-changeset
 *
 * Generate a Changesets-format .md file.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { BumpProposal } from "../propose-bump";
import type { PackageClassification } from "../classify-changes";

export interface GenerateChangesetInput {
  proposals: BumpProposal[];
  classifications: PackageClassification[];
  summary?: string;
  changesetDir: string;
}

export interface GenerateChangesetOutput {
  filePath: string;
  fileName: string;
  content: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function randomId(): string {
  return Array.from({ length: 8 }, () =>
    "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]
  ).join("");
}

export async function run(input: GenerateChangesetInput): Promise<GenerateChangesetOutput> {
  const frontmatterLines: string[] = ["---"];
  for (const p of input.proposals) {
    frontmatterLines.push(`"${p.package}": ${p.bump}`);
  }
  frontmatterLines.push("---");
  frontmatterLines.push("");

  let summary = input.summary;
  if (!summary) {
    const titles = input.classifications
      .flatMap((c) => c.commits)
      .filter((c) => ["feat", "fix", "breaking"].includes(c.kind))
      .map((c) => `- ${c.title}`)
      .slice(0, 10);
    summary = titles.length > 0
      ? `Release includes:\n\n${titles.join("\n")}`
      : "Release with multiple improvements.";
  }

  const content = frontmatterLines.join("\n") + summary + "\n";

  const fileName = `${slugify(summary.split("\n")[0])}-${randomId()}.md`;
  const filePath = join(input.changesetDir, fileName);

  await mkdir(input.changesetDir, { recursive: true });
  await writeFile(filePath, content, "utf-8");

  return { filePath, fileName, content };
}
