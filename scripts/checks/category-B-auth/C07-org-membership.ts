import { execa } from "execa";
import type { Check, CheckContext, CheckResult } from "../types";

export const C07_OrgMembership: Check = {
  id: "C07",
  category: "auth",
  severity: "warning",
  description: "Authenticated user has org membership for @orqenix scope",
  rationale: "Only org members can publish to @orqenix/*; fail early if not authorized",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const scope = ctx.mode === "oss" ? "@orqenix" : "@orqenix-pro";
    const org = ctx.mode === "oss" ? "orqenix" : "orqenix-pro";

    try {
      const { stdout } = await execa("npm", ["org", "ls", org]);
      const user = await execa("npm", ["whoami"]);
      const userName = user.stdout.trim();

      if (stdout.includes(userName)) {
        return {
          id: this.id,
          severity: this.severity,
          status: "pass",
          durationMs: Date.now() - start,
          message: `User ${userName} is a member of ${org} org`,
        };
      }

      return {
        id: this.id,
        severity: this.severity,
        status: "warn",
        durationMs: Date.now() - start,
        message: `User ${userName} not found in ${org} org members`,
        details: {
          recommendation: `Ensure you are added to the npm ${org} organization`,
          docsUrl: "https://docs.npmjs.com/organizations",
        },
      };
    } catch (err) {
      return {
        id: this.id,
        severity: this.severity,
        status: "warn",
        durationMs: Date.now() - start,
        message: `Could not verify org membership: ${(err as Error).message}`,
        details: {
          recommendation: "Verify org membership manually: npm org ls orqenix",
        },
      };
    }
  },
};
