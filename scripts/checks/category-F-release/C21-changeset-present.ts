import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Check, CheckContext, CheckResult } from "../types";

export const C21_ChangesetPresent: Check = {
  id: "C21",
  category: "release",
  severity: "blocking",
  description: "At least one changeset present",
  rationale: "Changesets drive version bumps and changelog generation; missing changeset means no version change",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const changesetDir = join(ctx.repoRoot, ".changeset");

    try {
      const entries = await readdir(changesetDir);
      const mdFiles = entries.filter((e) => e.endsWith(".md") && e !== "README.md");

      if (mdFiles.length > 0) {
        return {
          id: this.id,
          severity: this.severity,
          status: "pass",
          durationMs: Date.now() - start,
          message: `${mdFiles.length} changeset(s) found (${mdFiles.slice(0, 3).join(", ")}${mdFiles.length > 3 ? "..." : ""})`,
        };
      }

      return {
        id: this.id,
        severity: this.severity,
        status: "fail",
        durationMs: Date.now() - start,
        message: "No changeset .md files found in .changeset/",
        details: {
          recommendation: "Run `pnpm changeset` to create a changeset entry",
        },
      };
    } catch {
      return {
        id: this.id,
        severity: this.severity,
        status: "fail",
        durationMs: Date.now() - start,
        message: ".changeset/ directory not found",
        details: {
          recommendation: "Initialize changesets with `pnpm changeset init`",
        },
      };
    }
  },
};
