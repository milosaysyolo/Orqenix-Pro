import { execa } from "execa";
import type { Check, CheckContext, CheckResult } from "../types";

export const C18_ForbiddenFilesExcluded: Check = {
  id: "C18",
  category: "security",
  severity: "blocking",
  description: "Forbidden files excluded from tarball",
  rationale: "Policy defines forbidden files that must never be included in published packages",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const forbidden = ctx.policy?.policy?.forbidden_files_in_tarball ?? [];
    const tarballContains: Array<{ pkg: string; file: string }> = [];

    for (const pkg of ctx.packages.filter((p) => p.classification === "publishable")) {
      try {
        const { stdout } = await execa("npm", ["pack", "--dry-run", "--json"], { cwd: pkg.path });
        const result = JSON.parse(stdout) as Array<{ files: Array<{ path: string }> }>;
        const files = result[0]?.files ?? [];

        for (const f of files) {
          for (const pattern of forbidden) {
            const regex = new RegExp(
              pattern
                .replace(/\*\*/g, ".*")
                .replace(/\*/g, "[^/]*")
                .replace(/\./g, "\\."),
              "i"
            );
            if (regex.test(f.path)) {
              tarballContains.push({ pkg: pkg.name, file: f.path });
            }
          }
        }
      } catch {
        // Skip packages that fail npm pack
      }
    }

    if (tarballContains.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: "No forbidden files found in tarballs",
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "fail",
      durationMs: Date.now() - start,
      message: `${tarballContains.length} forbidden file(s) found in tarballs`,
      details: {
        affectedPackages: [...new Set(tarballContains.map((t) => t.pkg))],
        rawOutput: tarballContains,
        recommendation: "Update .npmignore or files field to exclude these files",
      },
    };
  },
};
