import { execa } from "execa";
import type { Check, CheckContext, CheckResult } from "../types";

const MIN_PNPM = 9;

export const C04_PnpmVersion: Check = {
  id: "C04",
  category: "environment",
  severity: "blocking",
  description: "pnpm >= 9.0.0",
  rationale: "pnpm-lock.yaml and workspace protocol require pnpm >= 9",

  async run(_: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    try {
      const { stdout } = await execa("pnpm", ["--version"]);
      const versionStr = stdout.trim();
      const major = parseInt(versionStr.split(".")[0], 10);

      if (major >= MIN_PNPM) {
        return {
          id: this.id,
          severity: this.severity,
          status: "pass",
          durationMs: Date.now() - start,
          message: `pnpm ${versionStr} (major ${major}) >= ${MIN_PNPM}`,
        };
      }

      return {
        id: this.id,
        severity: this.severity,
        status: "fail",
        durationMs: Date.now() - start,
        message: `pnpm ${versionStr} is too old. Need >= ${MIN_PNPM}`,
        details: {
          recommendation: `Install pnpm >= ${MIN_PNPM}: npm install -g pnpm@latest`,
        },
      };
    } catch (err) {
      return {
        id: this.id,
        severity: this.severity,
        status: "fail",
        durationMs: Date.now() - start,
        message: `pnpm --version failed: ${(err as Error).message}`,
      };
    }
  },
};
