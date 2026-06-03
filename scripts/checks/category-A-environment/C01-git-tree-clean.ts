import { execa } from "execa";
import type { Check, CheckContext, CheckResult } from "../types";

export const C01_GitTreeClean: Check = {
  id: "C01",
  category: "environment",
  severity: "blocking",
  description: "Git working tree must be clean",
  rationale: "Uncommitted changes risk publishing inconsistent state to npm",

  async run(_: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    try {
      const { stdout } = await execa("git", ["status", "--porcelain"]);
      const dirty = stdout.trim();

      if (dirty === "") {
        return {
          id: this.id,
          severity: this.severity,
          status: "pass",
          durationMs: Date.now() - start,
          message: "Git tree is clean",
        };
      }

      const files = dirty.split("\n").map((l) => l.trim());
      return {
        id: this.id,
        severity: this.severity,
        status: "fail",
        durationMs: Date.now() - start,
        message: `Git tree has ${files.length} uncommitted change(s)`,
        details: {
          affectedFiles: files,
          recommendation: "Commit or stash changes before running publish",
        },
      };
    } catch (err) {
      return {
        id: this.id,
        severity: this.severity,
        status: "fail",
        durationMs: Date.now() - start,
        message: `git status failed: ${(err as Error).message}`,
      };
    }
  },
};
