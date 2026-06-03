import { describe, it, expect, vi } from "vitest";
import { C09_PublishabilityConfirmed } from "../category-C-packages/C09-publishability-confirmed";
import type { CheckContext } from "../types";

describe("C09 Publishability Confirmed", () => {
  it("passes when all discovered packages match whitelist", async () => {
    const ctx = buildContext({
      publishableNames: ["@orqenix/core", "@orqenix/cli"],
      whitelist: ["@orqenix/core", "@orqenix/cli"],
    });
    const result = await C09_PublishabilityConfirmed.run(ctx);
    expect(result.status).toBe("pass");
  });

  it("fails when discovered package not in whitelist", async () => {
    const ctx = buildContext({
      publishableNames: ["@orqenix/core", "@orqenix/example-app"],
      whitelist: ["@orqenix/core"],
    });
    const result = await C09_PublishabilityConfirmed.run(ctx);
    expect(result.status).toBe("fail");
    expect(result.details?.affectedPackages).toContain("@orqenix/example-app");
  });

  it("fails when suspicious package name in 'all' mode", async () => {
    const ctx = buildContext({
      publishableNames: ["@orqenix/core", "@orqenix/example-app"],
      mode: "all",
    });
    const result = await C09_PublishabilityConfirmed.run(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("suspicious");
  });

  it("warns when 'all' mode and no suspicious names", async () => {
    const ctx = buildContext({
      publishableNames: ["@orqenix/core", "@orqenix/cli"],
      mode: "all",
    });
    const result = await C09_PublishabilityConfirmed.run(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("without explicit approval");
  });

  it("warns when whitelisted packages not found in repo", async () => {
    const ctx = buildContext({
      publishableNames: ["@orqenix/core"],
      whitelist: ["@orqenix/core", "@orqenix/missing-pkg"],
    });
    const result = await C09_PublishabilityConfirmed.run(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("not found in repo");
  });
});

function buildContext(args: {
  publishableNames: string[];
  whitelist?: string[];
  mode?: "all" | "whitelist";
}): CheckContext {
  const mode = args.mode ?? "whitelist";

  // Mock readFile to return whitelist content
  const yamlContent = `version: 1\nmode: ${mode}\npackages:\n${(args.whitelist ?? []).map((p) => `  - "${p}"`).join("\n")}`;

  vi.mock("node:fs/promises", () => ({
    readFile: vi.fn().mockResolvedValue(yamlContent),
  }));

  return {
    repoRoot: "/tmp/test-repo",
    mode: "oss",
    policy: {} as any,
    packages: [],
    publishableNames: args.publishableNames,
    env: {},
  };
}
