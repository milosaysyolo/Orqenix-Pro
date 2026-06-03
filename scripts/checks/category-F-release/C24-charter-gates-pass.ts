import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import type { Check, CheckContext, CheckResult } from "../types";

export const C24_CharterGatesPass: Check = {
  id: "C24",
  category: "release",
  severity: "blocking",
  description: "Charter gates G1..G35 pass for this release phase",
  rationale: "Release policy defines required gates that must pass before publish",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();

    const requiredGates = ctx.mode === "pro"
      ? ctx.policy?.policy?.required_gates?.phase_5_pro
      : ctx.policy?.policy?.required_gates?.phase_5_oss;

    if (!requiredGates || requiredGates.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "skip",
        durationMs: Date.now() - start,
        message: "No required gates defined in release policy; skipped",
      };
    }

    const gatesDir = ctx.mode === "pro" ? ".orqenix-pro/gate-reports" : ".orqenix/gate-reports";
    const failures: string[] = [];

    for (const gate of requiredGates) {
      const reportPath = join(ctx.repoRoot, gatesDir, `${gate}.json`);
      try {
        const report = JSON.parse(await readFile(reportPath, "utf-8"));
        if (report.status !== "pass") {
          failures.push(`${gate}: ${report.status} (${report.message ?? "no message"})`);
        }
      } catch {
        failures.push(`${gate}: report not found or unparseable`);
      }
    }

    if (failures.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: `All ${requiredGates.length} required gates pass (${requiredGates.join(", ")})`,
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "fail",
      durationMs: Date.now() - start,
      message: `${failures.length}/${requiredGates.length} required gate(s) failing`,
      details: {
        rawOutput: failures,
        recommendation: "Run `pnpm test:charter` to execute and fix failing gates",
      },
    };
  },
};
