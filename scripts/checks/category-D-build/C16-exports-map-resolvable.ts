import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Check, CheckContext, CheckResult } from "../types";

export const C16_ExportsMapResolvable: Check = {
  id: "C16",
  category: "build",
  severity: "blocking",
  description: "exports map paths resolvable",
  rationale: "If exports map points to missing files, Node.js and bundlers will fail to resolve the package",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const unresolvable: Array<{ pkg: string; path: string }> = [];

    for (const pkg of ctx.packages.filter((p) => p.classification === "publishable")) {
      const exportsMap = pkg.current.exports as Record<string, unknown> | undefined;
      if (!exportsMap) {
        unresolvable.push({ pkg: pkg.name, path: "exports" });
        continue;
      }

      for (const [key, value] of Object.entries(exportsMap)) {
        if (key === "./package.json") continue;

        const paths = typeof value === "string"
          ? [value]
          : Object.values((value || {}) as Record<string, string>);

        for (const exportPath of paths) {
          const resolved = join(ctx.repoRoot, pkg.path, exportPath);
          try {
            const entryStat = await stat(resolved);
            if (!entryStat.isFile()) {
              unresolvable.push({ pkg: pkg.name, path: exportPath });
            }
          } catch {
            unresolvable.push({ pkg: pkg.name, path: exportPath });
          }
        }
      }
    }

    if (unresolvable.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: "All exports map paths are resolvable",
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "fail",
      durationMs: Date.now() - start,
      message: `${unresolvable.length} export path(s) not found`,
      details: {
        affectedPackages: [...new Set(unresolvable.map((u) => u.pkg))],
        rawOutput: unresolvable,
        recommendation: "Build packages or fix exports map paths",
      },
    };
  },
};
