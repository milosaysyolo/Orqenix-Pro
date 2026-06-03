import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Check, CheckContext, CheckResult } from "../types";

const DEFAULT_BUDGET_BYTES = 1024 * 1024; // 1 MB

export const C15_BundleSizeBudget: Check = {
  id: "C15",
  category: "build",
  severity: "warning",
  description: "Bundle size within budget",
  rationale: "Oversized bundles impact install time and runtime performance",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const oversized: Array<{ pkg: string; size: number; budget: number }> = [];

    for (const pkg of ctx.packages.filter((p) => p.classification === "publishable")) {
      const distIndex = join(ctx.repoRoot, pkg.path, "dist", "index.js");
      try {
        const stat_ = await stat(distIndex);
        const size = stat_.size;
        if (size > DEFAULT_BUDGET_BYTES) {
          oversized.push({ pkg: pkg.name, size, budget: DEFAULT_BUDGET_BYTES });
        }
      } catch {
        // Skip packages without built output
      }
    }

    if (oversized.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: "All bundle sizes within budget",
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "warn",
      durationMs: Date.now() - start,
      message: `${oversized.length} package(s) exceed bundle size budget`,
      details: {
        affectedPackages: oversized.map((o) => o.pkg),
        rawOutput: oversized.map((o) => ({ pkg: o.pkg, sizeBytes: o.size, budgetBytes: o.budget })),
        recommendation: "Consider code splitting or tree-shaking for large bundles",
      },
    };
  },
};
