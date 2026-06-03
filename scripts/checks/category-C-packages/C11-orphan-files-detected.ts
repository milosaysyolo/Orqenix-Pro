import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Check, CheckContext, CheckResult } from "../types";

export const C11_OrphanFilesDetected: Check = {
  id: "C11",
  category: "packages",
  severity: "warning",
  description: "No orphan LICENSE or CHANGELOG files outside actual packages",
  rationale: "Leftover generated files cause confusion; extra LICENSE files look like license violations",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const orphans: string[] = [];

    const packageNames = new Set(ctx.packages.map((p) => p.name));
    const packagePaths = new Set(ctx.packages.map((p) => p.path.replace(/\\/g, "/")));

    const candidates: string[] = [];

    async function scanDir(dir: string): Promise<void> {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = join(dir, entry.name).replace(/\\/g, "/");
          if (entry.isDirectory()) {
            if (!full.includes("node_modules") && !full.startsWith(".")) {
              await scanDir(full);
            }
          } else if ((entry.name === "LICENSE" || entry.name === "CHANGELOG.md") && !full.includes("node_modules")) {
            const parent = full.substring(0, full.lastIndexOf("/"));
            if (!packagePaths.has(parent)) {
              candidates.push(full);
            }
          }
        }
      } catch {
        // skip unreadable dirs
      }
    }

    await scanDir(".");

    for (const f of candidates) {
      const parts = f.split("/");
      const isInPackagesDir = parts.includes("packages") && parts.indexOf("packages") < parts.length - 1;
      if (isInPackagesDir) {
        orphans.push(f);
      }
    }

    if (orphans.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: "No orphan LICENSE/CHANGELOG files detected",
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "warn",
      durationMs: Date.now() - start,
      message: `Found ${orphans.length} orphan file(s) in packages/ directories`,
      details: {
        affectedFiles: orphans,
        recommendation: "Remove orphan files: they don't belong to any known package",
      },
    };
  },
};
