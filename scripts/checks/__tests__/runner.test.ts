import { describe, it, expect } from "vitest";
import { runChecks } from "../runner";
import type { Check, CheckContext, CheckResult } from "../types";

function makeCheck(id: string, result: CheckResult): Check {
  return {
    id,
    category: "test",
    severity: "blocking",
    description: `Test check ${id}`,
    rationale: "Testing",
    async run(): Promise<CheckResult> {
      return result;
    },
  };
}

const dummyContext: CheckContext = {
  repoRoot: "/tmp",
  mode: "oss",
  policy: {} as any,
  packages: [],
  publishableNames: [],
  env: {},
};

describe("runner", () => {
  it("runs all checks and returns results", async () => {
    const checks = [
      makeCheck("T01", { id: "T01", severity: "blocking", status: "pass", durationMs: 1, message: "OK" }),
      makeCheck("T02", { id: "T02", severity: "blocking", status: "pass", durationMs: 1, message: "OK" }),
    ];
    const results = await runChecks(checks, dummyContext);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === "pass")).toBe(true);
  });

  it("catches check exceptions and returns fail", async () => {
    const throwingCheck: Check = {
      id: "T03",
      category: "test",
      severity: "blocking",
      description: "Throws",
      rationale: "Testing",
      async run() {
        throw new Error("Boom");
      },
    };
    const results = await runChecks([throwingCheck], dummyContext);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("fail");
    expect(results[0].message).toContain("Boom");
  });

  it("handles empty check list", async () => {
    const results = await runChecks([], dummyContext);
    expect(results).toHaveLength(0);
  });

  it("runs checks with concurrency batching", async () => {
    const checks = Array.from({ length: 12 }, (_, i) =>
      makeCheck(`T${i}`, { id: `T${i}`, severity: "blocking", status: "pass", durationMs: 1, message: "OK" })
    );
    const results = await runChecks(checks, dummyContext);
    expect(results).toHaveLength(12);
  });

  it("returns mixed statuses correctly", async () => {
    const checks = [
      makeCheck("PASS", { id: "PASS", severity: "blocking", status: "pass", durationMs: 1, message: "OK" }),
      makeCheck("FAIL", { id: "FAIL", severity: "blocking", status: "fail", durationMs: 1, message: "Fail" }),
    ];
    const results = await runChecks(checks, dummyContext);
    expect(results.filter((r) => r.status === "pass")).toHaveLength(1);
    expect(results.filter((r) => r.status === "fail")).toHaveLength(1);
  });
});
