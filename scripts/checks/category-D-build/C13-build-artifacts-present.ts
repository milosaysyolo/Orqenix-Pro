import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Check, CheckContext, CheckResult } from "../types";

export const C13_BuildArtifactsPresent: Check = {
  id: "C13",
  category: "build",
  severity: "blocking",
  description: "All publishable packages have dist/ directory",
  rationale: "Missing dist/ means build hasn't run; publishing would ship an empty or broken package",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const missing: string[] = [];

    for (const pkg of ctx.packages.filter((p) => p.classification === "publishable")) {
      const distPath = join(ctx.repoRoot, pkg.path, "dist");
      try {
        const distStat = await stat(distPath);
        if (!distStat.isDirectory()) {
          missing.push(pkg.name);
        }
      } catch {
        missing.push(pkg.name);
      }
    }

    if (missing.length === 0) {
      const count = ctx.packages.filter((p) => p.classification === "publishable").length;
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: `All ${count} packages have dist/`,
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "fail",
      durationMs: Date.now() - start,
      message: `${missing.length} package(s) missing dist/`,
      details: {
        affectedPackages: missing,
        recommendation: "Run `pnpm build` before publish",
      },
    };
  },
};
