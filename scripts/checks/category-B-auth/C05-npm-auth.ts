import { execa } from "execa";
import type { Check, CheckContext, CheckResult } from "../types";

export const C05_NpmAuth: Check = {
  id: "C05",
  category: "auth",
  severity: "blocking",
  description: "npm whoami succeeds",
  rationale: "Publish requires authenticated npm user; fail early if not authenticated",

  async run(_: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    try {
      const { stdout } = await execa("npm", ["whoami"]);
      const user = stdout.trim();

      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: `Authenticated as: ${user}`,
      };
    } catch (err) {
      return {
        id: this.id,
        severity: this.severity,
        status: "fail",
        durationMs: Date.now() - start,
        message: `npm whoami failed: ${(err as Error).message}`,
        details: {
          recommendation: "Run `npm login` or set NPM_TOKEN env var",
        },
      };
    }
  },
};
