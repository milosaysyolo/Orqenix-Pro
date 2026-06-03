import { readFile, stat as fsStat } from "node:fs/promises";
import { join } from "node:path";
import type { Check, CheckContext, CheckResult } from "../types";

const MIN_README_LENGTH = 100;
const SUSPICIOUS_PATTERNS = [
  /orqenix [a-z-]+ package/i,
  /TODO/i,
  /FIXME/i,
  /lorem ipsum/i,
  /replace me/i,
  /example description/i,
];

export const C12_ReadmeContentQuality: Check = {
  id: "C12",
  category: "packages",
  severity: "warning",
  description: "README description quality check",
  rationale: "Low-quality READMEs hurt npm discoverability and user trust",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const issues: Array<{ pkg: string; reason: string }> = [];

    for (const pkg of ctx.packages.filter((p) => p.classification === "publishable")) {
      const readmePath = join(ctx.repoRoot, pkg.path, "README.md");
      try {
        const stat_ = await fsStat(readmePath);
        if (!stat_.isFile()) {
          issues.push({ pkg: pkg.name, reason: "README.md not found" });
          continue;
        }

        const content = await readFile(readmePath, "utf-8");
        const trimmed = content.trim();

        if (trimmed.length < MIN_README_LENGTH) {
          issues.push({ pkg: pkg.name, reason: `README too short (${trimmed.length} chars < ${MIN_README_LENGTH})` });
          continue;
        }

        for (const pattern of SUSPICIOUS_PATTERNS) {
          if (pattern.test(trimmed)) {
            issues.push({ pkg: pkg.name, reason: `README contains suspicious text matching: ${pattern.source}` });
            break;
          }
        }
      } catch {
        issues.push({ pkg: pkg.name, reason: "README.md not readable or missing" });
      }
    }

    if (issues.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: "All README.md files pass quality check",
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "warn",
      durationMs: Date.now() - start,
      message: `${issues.length} README issue(s) found`,
      details: {
        affectedPackages: [...new Set(issues.map((i) => i.pkg))],
        rawOutput: issues,
        recommendation: "Improve README.md content for each affected package",
      },
    };
  },
};
