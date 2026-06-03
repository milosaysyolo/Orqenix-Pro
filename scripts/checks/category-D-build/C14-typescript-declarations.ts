import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Check, CheckContext, CheckResult } from "../types";

export const C14_TypescriptDeclarations: Check = {
  id: "C14",
  category: "build",
  severity: "blocking",
  description: "TypeScript .d.ts files exist in dist/",
  rationale: "Without .d.ts files, TypeScript consumers cannot use the package",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const missing: string[] = [];

    for (const pkg of ctx.packages.filter((p) => p.classification === "publishable")) {
      const dtsPath = join(ctx.repoRoot, pkg.path, "dist", "index.d.ts");
      try {
        const dtsStat = await stat(dtsPath);
        if (!dtsStat.isFile()) {
          missing.push(pkg.name);
        }
      } catch {
        missing.push(pkg.name);
      }
    }

    if (missing.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: "All packages have dist/index.d.ts",
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "fail",
      durationMs: Date.now() - start,
      message: `${missing.length} package(s) missing dist/index.d.ts`,
      details: {
        affectedPackages: missing,
        recommendation: "Ensure tsup config generates .d.ts files (dts: true)",
      },
    };
  },
};
