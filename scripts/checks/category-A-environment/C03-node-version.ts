import { execa } from "execa";
import type { Check, CheckContext, CheckResult } from "../types";

const MIN_NODE = 20;

export const C03_NodeVersion: Check = {
  id: "C03",
  category: "environment",
  severity: "blocking",
  description: "Node.js >= 20.0.0",
  rationale: "Package engines.node requires >=20.0.0; older versions may produce incompatible builds",

  async run(_: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    try {
      const { stdout } = await execa("node", ["--version"]);
      const versionStr = stdout.trim().replace(/^v/, "");
      const major = parseInt(versionStr.split(".")[0], 10);

      if (major >= MIN_NODE) {
        return {
          id: this.id,
          severity: this.severity,
          status: "pass",
          durationMs: Date.now() - start,
          message: `Node ${versionStr} (major ${major}) >= ${MIN_NODE}`,
        };
      }

      return {
        id: this.id,
        severity: this.severity,
        status: "fail",
        durationMs: Date.now() - start,
        message: `Node ${versionStr} is too old. Need >= ${MIN_NODE}.0.0`,
        details: {
          recommendation: `Install Node >= ${MIN_NODE}.0.0 via nvm or fnm`,
        },
      };
    } catch (err) {
      return {
        id: this.id,
        severity: this.severity,
        status: "fail",
        durationMs: Date.now() - start,
        message: `node --version failed: ${(err as Error).message}`,
      };
    }
  },
};
