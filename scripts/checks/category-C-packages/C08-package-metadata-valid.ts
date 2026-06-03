import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Check, CheckContext, CheckResult } from "../types";

const REQUIRED_FIELDS = [
  "name", "version", "description", "license", "author",
  "homepage", "repository", "bugs", "keywords",
  "main", "module", "types", "exports", "files",
  "publishConfig", "engines",
];

const REQUIRED_PUBLISH_CONFIG_KEYS = ["access", "registry"];
const REQUIRED_EXPORTS_KEYS = [".", "./package.json"];

export const C08_PackageMetadataValid: Check = {
  id: "C08",
  category: "packages",
  severity: "blocking",
  description: "All required package.json fields present for publishable packages",
  rationale: "Missing fields cause npm publish to fail or produce broken packages",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const issues: Array<{ pkg: string; field: string; detail: string }> = [];

    for (const pkg of ctx.packages.filter((p) => p.classification === "publishable")) {
      try {
        const content = JSON.parse(await readFile(pkg.pkgJsonPath, "utf-8"));

        for (const field of REQUIRED_FIELDS) {
          if (content[field] === undefined || content[field] === null) {
            issues.push({ pkg: pkg.name, field, detail: "Missing required field" });
          }
        }

        const pc = content.publishConfig as Record<string, unknown> | undefined;
        if (pc) {
          for (const key of REQUIRED_PUBLISH_CONFIG_KEYS) {
            if (pc[key] === undefined) {
              issues.push({ pkg: pkg.name, field: `publishConfig.${key}`, detail: "Missing in publishConfig" });
            }
          }
        }

        const ex = content.exports as Record<string, unknown> | undefined;
        if (ex) {
          for (const key of REQUIRED_EXPORTS_KEYS) {
            if (ex[key] === undefined) {
              issues.push({ pkg: pkg.name, field: `exports.${key}`, detail: "Missing in exports map" });
            }
          }
        }
      } catch (err) {
        issues.push({ pkg: pkg.name, field: "package.json", detail: `Failed to parse: ${(err as Error).message}` });
      }
    }

    if (issues.length === 0) {
      const count = ctx.packages.filter((p) => p.classification === "publishable").length;
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: `All ${count} publishable packages have valid metadata`,
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "fail",
      durationMs: Date.now() - start,
      message: `${issues.length} metadata issue(s) found across packages`,
      details: {
        affectedPackages: [...new Set(issues.map((i) => i.pkg))],
        rawOutput: issues,
        recommendation: "Run `pnpm tsx scripts/normalize-packages.ts --apply` to fix",
      },
    };
  },
};
