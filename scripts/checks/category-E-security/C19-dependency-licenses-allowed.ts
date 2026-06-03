import { execa } from "execa";
import type { Check, CheckContext, CheckResult } from "../types";

const ALLOWED_LICENSES = [
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause",
  "ISC", "CC0-1.0", "Unlicense", "Python-2.0",
  "0BSD",
];

const WARN_LICENSES = ["GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0"];

export const C19_DependencyLicensesAllowed: Check = {
  id: "C19",
  category: "security",
  severity: "warning",
  description: "Dependency licenses on allowlist",
  rationale: "Copyleft or unapproved licenses can create legal obligations for the project",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const disallowed: string[] = [];
    const warnings: string[] = [];

    try {
      const { stdout } = await execa("pnpm", ["licenses", "ls", "--json"], { reject: false });
      if (!stdout) {
        return {
          id: this.id,
          severity: this.severity,
          status: "skip",
          durationMs: Date.now() - start,
          message: "pnpm licenses not available; skipped",
        };
      }

      const data = JSON.parse(stdout) as Array<{ name: string; license: string }>;
      for (const dep of data) {
        const lic = dep.license?.trim() ?? "UNKNOWN";
        if (!ALLOWED_LICENSES.includes(lic) && !WARN_LICENSES.includes(lic)) {
          disallowed.push(`${dep.name} (${lic})`);
        } else if (WARN_LICENSES.includes(lic)) {
          warnings.push(`${dep.name} (${lic})`);
        }
      }
    } catch {
      return {
        id: this.id,
        severity: this.severity,
        status: "skip",
        durationMs: Date.now() - start,
        message: "License check unavailable; skipped",
      };
    }

    if (disallowed.length === 0 && warnings.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: "All dependency licenses on allowlist",
      };
    }

    const allIssues = [
      ...disallowed.map((d) => `DISALLOWED: ${d}`),
      ...warnings.map((w) => `WARN: ${w}`),
    ];

    return {
      id: this.id,
      severity: this.severity,
      status: disallowed.length > 0 ? "warn" : "warn",
      durationMs: Date.now() - start,
      message: `${disallowed.length} disallowed + ${warnings.length} copyleft license(s) found`,
      details: {
        rawOutput: allIssues,
        recommendation: "Review licenses. Avoid GPL/AGPL dependencies for Apache-2.0 project.",
      },
    };
  },
};
