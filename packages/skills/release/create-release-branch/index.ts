/**
 * Skill: create-release-branch
 *
 * Create a release/* branch, commit changeset, do NOT push.
 */

import { execa } from "execa";

export interface CreateBranchInput {
  version: string;
  phaseNumber?: number;
  changesetPath: string;
}

export interface CreateBranchOutput {
  branchName: string;
  commitSha: string;
}

export async function run(input: CreateBranchInput): Promise<CreateBranchOutput> {
  const branchName = input.phaseNumber
    ? `release/v${input.version}-phase-${input.phaseNumber}`
    : `release/v${input.version}`;

  const { exitCode } = await execa("git", ["rev-parse", "--verify", branchName], {
    reject: false,
  });
  if (exitCode === 0) {
    throw new Error(`Branch ${branchName} already exists. Delete first or pick a different version.`);
  }

  await execa("git", ["checkout", "-b", branchName]);
  await execa("git", ["add", input.changesetPath]);
  await execa("git", [
    "commit",
    "-m",
    `chore(release): propose v${input.version}`,
    "--no-verify",
  ]);

  const { stdout: commitSha } = await execa("git", ["rev-parse", "HEAD"]);

  return { branchName, commitSha: commitSha.trim() };
}
