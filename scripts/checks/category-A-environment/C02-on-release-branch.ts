import { execa } from "execa";
import type { Check, CheckContext, CheckResult } from "../types";

export const C02_OnReleaseBranch: Check = {
  id: "C02",
  category: "environment",
  severity: "warning",
  description: "Current branch must be main or release/*",
  rationale: "Publishing from feature or dev branches is risky and non-standard",

  async run(_: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    try {
      const { stdout } = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
      const branch = stdout.trim();
      const allowed = branch === "main" || branch.startsWith("release/") || branch.startsWith("release-setup/");

      if (allowed) {
        return {
          id: this.id,
          severity: this.severity,
          status: "pass",
          durationMs: Date.now() - start,
          message: `On allowed branch: ${branch}`,
        };
      }

      return {
        id: this.id,
        severity: this.severity,
        status: "warn",
        durationMs: Date.now() - start,
        message: `Branch '${branch}' is not main or release/*`,
        details: {
          recommendation: "Switch to main or a release/ branch before publish",
        },
      };
    } catch (err) {
      return {
        id: this.id,
        severity: this.severity,
        status: "fail",
        durationMs: Date.now() - start,
        message: `git branch detection failed: ${(err as Error).message}`,
      };
    }
  },
};
