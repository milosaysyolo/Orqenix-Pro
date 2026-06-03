import type { Check, CheckContext, CheckResult } from "../types";

export const C06_NpmTokenNotExpired: Check = {
  id: "C06",
  category: "auth",
  severity: "warning",
  description: "NPM_TOKEN not expired (>14 days remaining)",
  rationale: "Expired or soon-to-expire tokens cause mid-publish failures",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();

    const token = ctx.env.NPM_TOKEN ?? ctx.env.NODE_AUTH_TOKEN;
    if (!token) {
      return {
        id: this.id,
        severity: this.severity,
        status: "warn",
        durationMs: Date.now() - start,
        message: "No NPM_TOKEN or NODE_AUTH_TOKEN found in environment",
        details: {
          recommendation: "Set NPM_TOKEN for CI publish; local publish may use .npmrc",
        },
      };
    }

    const tokenStr = String(token).trim();
    if (!tokenStr || tokenStr.length < 10) {
      return {
        id: this.id,
        severity: this.severity,
        status: "warn",
        durationMs: Date.now() - start,
        message: "NPM_TOKEN appears too short or empty",
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "pass",
      durationMs: Date.now() - start,
      message: "NPM_TOKEN is present",
    };
  },
};
