import type { Check, CheckContext, CheckResult } from "../types";

export const C22_VersionNotPublished: Check = {
  id: "C22",
  category: "release",
  severity: "blocking",
  description: "Each package version about to be published must not already exist on npm",
  rationale: "npm forbids republishing the same version. Detect conflict before CI fails halfway.",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const conflicts: Array<{ pkg: string; version: string }> = [];

    const publishable = ctx.packages.filter((p) => p.classification === "publishable");

    await Promise.all(publishable.map(async (pkg) => {
      const name = pkg.name;
      const version = pkg.current.version as string;

      try {
        const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
        if (res.status === 404) return;

        const data = await res.json() as { versions?: Record<string, unknown> };
        if (data.versions && version in data.versions) {
          conflicts.push({ pkg: name, version });
        }
      } catch {
        // Network error, skip
      }
    }));

    if (conflicts.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: `All ${publishable.length} packages have publishable versions`,
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "fail",
      durationMs: Date.now() - start,
      message: `${conflicts.length} package(s) already have this version on npm`,
      details: {
        affectedPackages: conflicts.map((c) => `${c.pkg}@${c.version}`),
        recommendation: "Bump version via `pnpm changeset` or use a snapshot release",
      },
    };
  },
};
