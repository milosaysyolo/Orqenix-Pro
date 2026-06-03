import type { Check, CheckContext, CheckResult } from "../types";

export const C23_VersionMonotonic: Check = {
  id: "C23",
  category: "release",
  severity: "blocking",
  description: "New version > current published version",
  rationale: "Prevents accidental version downgrades, ensures monotonic version progression",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const downgrades: Array<{ pkg: string; newVersion: string; publishedVersion: string }> = [];

    const publishable = ctx.packages.filter((p) => p.classification === "publishable");

    await Promise.all(publishable.map(async (pkg) => {
      const name = pkg.name;
      const newVersion = pkg.current.version as string;

      try {
        const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
        if (res.status === 404) return;

        const data = await res.json() as { "dist-tags"?: Record<string, string> };
        const latest = data["dist-tags"]?.latest;
        if (!latest) return;

        if (compareVersions(newVersion, latest) < 0) {
          downgrades.push({ pkg: name, newVersion, publishedVersion: latest });
        }
      } catch {
        // Network error, skip
      }
    }));

    if (downgrades.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: "All versions are monotonic (new > published)",
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "fail",
      durationMs: Date.now() - start,
      message: `${downgrades.length} package(s) would be downgraded`,
      details: {
        affectedPackages: downgrades.map((d) => `${d.pkg}: ${d.newVersion} < ${d.publishedVersion}`),
        recommendation: "Bump version via changeset to be greater than published latest",
      },
    };
  },
};

function compareVersions(a: string, b: string): number {
  const aParts = a.replace(/[^0-9.]/g, "").split(".").map(Number);
  const bParts = b.replace(/[^0-9.]/g, "").split(".").map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNum = aParts[i] ?? 0;
    const bNum = bParts[i] ?? 0;
    if (aNum > bNum) return 1;
    if (aNum < bNum) return -1;
  }
  return 0;
}
