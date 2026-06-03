import type { Check, CheckResult, CheckContext } from "./types";

export async function runChecks(checks: Check[], ctx: CheckContext): Promise<CheckResult[]> {
  const CONCURRENCY = 8;
  const results: CheckResult[] = [];

  for (let i = 0; i < checks.length; i += CONCURRENCY) {
    const batch = checks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (check) => {
        try {
          return await check.run(ctx);
        } catch (err) {
          return {
            id: check.id,
            severity: check.severity,
            status: "fail" as const,
            durationMs: 0,
            message: `Check threw: ${(err as Error).message}`,
          };
        }
      })
    );
    results.push(...batchResults);
  }

  return results;
}
