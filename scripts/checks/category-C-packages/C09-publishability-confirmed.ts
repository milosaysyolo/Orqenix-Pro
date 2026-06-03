import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Check, CheckContext, CheckResult } from "../types";

export const C09_PublishabilityConfirmed: Check = {
  id: "C09",
  category: "packages",
  severity: "blocking",
  description: "All discovered publishable packages must match approved whitelist OR opt-in policy",
  rationale: "Prevent accidentally publishing internal/example/test packages to npm",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const policyPath = ctx.mode === "pro"
      ? ".orqenix-pro/publishable-whitelist.yaml"
      : ".orqenix/publishable-whitelist.yaml";

    let whitelist: string[] | "all" = "all";
    try {
      const content = await readFile(join(ctx.repoRoot, policyPath), "utf-8");
      const parsed = parseYaml(content) as { mode: "whitelist" | "all"; packages?: string[] };
      if (parsed.mode === "whitelist") {
        whitelist = parsed.packages ?? [];
      }
    } catch {
      // No whitelist file = "all" mode
    }

    const discovered = ctx.publishableNames;

    if (whitelist === "all") {
      const suspicious = discovered.filter((name) => {
        const base = name.split("/")[1] ?? "";
        return /^(example|test|fixture|demo|sample|playground|internal|private|tmp|scratch)/i.test(base);
      });

      if (suspicious.length > 0) {
        return {
          id: this.id,
          severity: this.severity,
          status: "fail",
          durationMs: Date.now() - start,
          message: `Found ${suspicious.length} suspicious package name(s) likely not meant for publish`,
          details: {
            affectedPackages: suspicious,
            recommendation: "Create a publishable-whitelist.yaml or mark these as private:true in package.json",
            docsUrl: "https://orqenix.dev/docs/release/publishable-whitelist",
          },
        };
      }

      return {
        id: this.id,
        severity: "warning",
        status: "warn",
        durationMs: Date.now() - start,
        message: `Whitelist mode: 'all'. Will publish ${discovered.length} package(s) without explicit approval`,
        details: {
          recommendation: "For production safety, create publishable-whitelist.yaml with explicit package list",
        },
      };
    }

    const notInWhitelist = discovered.filter((name) => !whitelist.includes(name));
    const inWhitelistButMissing = whitelist.filter((name) => !discovered.includes(name));

    if (notInWhitelist.length > 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "fail",
        durationMs: Date.now() - start,
        message: `${notInWhitelist.length} package(s) discovered but not in whitelist`,
        details: {
          affectedPackages: notInWhitelist,
          recommendation: "Add to whitelist or mark as private",
        },
      };
    }

    if (inWhitelistButMissing.length > 0) {
      return {
        id: this.id,
        severity: "warning",
        status: "warn",
        durationMs: Date.now() - start,
        message: `${inWhitelistButMissing.length} whitelisted package(s) not found in repo`,
        details: {
          affectedPackages: inWhitelistButMissing,
          recommendation: "Remove from whitelist if no longer needed",
        },
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "pass",
      durationMs: Date.now() - start,
      message: `All ${discovered.length} discovered packages match whitelist exactly`,
    };
  },
};
