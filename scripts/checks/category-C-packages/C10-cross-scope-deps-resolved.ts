import type { Check, CheckContext, CheckResult } from "../types";

export const C10_CrossScopeDepsResolved: Check = {
  id: "C10",
  category: "packages",
  severity: "blocking",
  description: "workspace:* and workspace:^ deps must resolve to published versions when crossing scopes",
  rationale: "When publishing @orqenix-pro/* that depends on @orqenix/*, the dep version must already exist on npm",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const problems: Array<{ pkg: string; dep: string; spec: string; reason: string }> = [];

    for (const pkg of ctx.packages.filter((p) => p.classification === "publishable")) {
      const allDeps = {
        ...((pkg.current.dependencies ?? {}) as Record<string, string>),
        ...((pkg.current.peerDependencies ?? {}) as Record<string, string>),
      };

      for (const [dep, spec] of Object.entries(allDeps)) {
        if (!spec.startsWith("workspace:")) continue;

        const isSameScope = inSameScopeAs(pkg.name, dep);
        if (isSameScope) continue;

        const isCrossScopeCrossRepo = isCrossRepoDep(pkg.name, dep, ctx.mode);
        if (!isCrossScopeCrossRepo) continue;

        problems.push({
          pkg: pkg.name,
          dep,
          spec,
          reason: "Cross-repo workspace: dep cannot be resolved at publish time. Must use regular version range.",
        });
      }
    }

    if (problems.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: "All cross-scope deps resolve correctly",
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "fail",
      durationMs: Date.now() - start,
      message: `${problems.length} cross-repo workspace: dep(s) need conversion to version range`,
      details: {
        affectedPackages: [...new Set(problems.map((p) => p.pkg))],
        rawOutput: problems,
        recommendation: `Update each problematic dep to use the published version, e.g., "@orqenix/core": "^0.5.0" instead of "workspace:*"`,
        docsUrl: "https://orqenix.dev/docs/release/cross-repo-deps",
      },
    };
  },
};

function inSameScopeAs(pkgName: string, depName: string): boolean {
  return pkgName.split("/")[0] === depName.split("/")[0];
}

function isCrossRepoDep(pkgName: string, depName: string, mode: "oss" | "pro"): boolean {
  if (mode === "oss") {
    return !depName.startsWith("@orqenix/");
  }
  return !depName.startsWith("@orqenix-pro/");
}
