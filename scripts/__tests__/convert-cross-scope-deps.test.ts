import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TMP = join(tmpdir(), `orqenix-test-${Date.now()}`);

async function setupFixture(packages: Record<string, object>): Promise<string> {
  await mkdir(join(TMP, "packages"), { recursive: true });
  for (const [name, content] of Object.entries(packages)) {
    await mkdir(join(TMP, "packages", name), { recursive: true });
    await writeFile(
      join(TMP, "packages", name, "package.json"),
      JSON.stringify(content, null, 2)
    );
  }
  return TMP;
}

describe("convert-cross-scope-deps", () => {
  beforeEach(async () => {
    await rm(TMP, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(TMP, { recursive: true, force: true });
  });

  it("converts workspace:* to version range for cross-scope dep", async () => {
    await setupFixture({
      "blast-radius": {
        name: "@orqenix-pro/blast-radius",
        version: "0.5.0",
        dependencies: {
          "@orqenix/core": "workspace:*",
        },
      },
    });

    const { execSync } = await import("node:child_process");
    execSync(
      `tsx scripts/convert-cross-scope-deps.ts --apply --oss-version=0.5.0`,
      { cwd: TMP, stdio: "inherit" }
    );

    const result = JSON.parse(
      await readFile(join(TMP, "packages/blast-radius/package.json"), "utf-8")
    );
    expect(result.dependencies["@orqenix/core"]).toBe("^0.5.0");
  });

  it("leaves same-scope workspace:* untouched", async () => {
    await setupFixture({
      "blast-radius": {
        name: "@orqenix-pro/blast-radius",
        version: "0.5.0",
        dependencies: {
          "@orqenix-pro/kb-token-store": "workspace:*",
        },
      },
    });

    const { execSync } = await import("node:child_process");
    execSync(
      `tsx scripts/convert-cross-scope-deps.ts --apply --oss-version=0.5.0`,
      { cwd: TMP }
    );

    const result = JSON.parse(
      await readFile(join(TMP, "packages/blast-radius/package.json"), "utf-8")
    );
    expect(result.dependencies["@orqenix-pro/kb-token-store"]).toBe("workspace:*");
  });

  it("dry-run does not modify files", async () => {
    const original = {
      name: "@orqenix-pro/blast-radius",
      version: "0.5.0",
      dependencies: { "@orqenix/core": "workspace:*" },
    };
    await setupFixture({ "blast-radius": original });

    const { execSync } = await import("node:child_process");
    execSync(`tsx scripts/convert-cross-scope-deps.ts --oss-version=0.5.0`, {
      cwd: TMP,
    });

    const result = JSON.parse(
      await readFile(join(TMP, "packages/blast-radius/package.json"), "utf-8")
    );
    expect(result.dependencies["@orqenix/core"]).toBe("workspace:*");
  });

  it("supports custom version range prefix", async () => {
    await setupFixture({
      "blast-radius": {
        name: "@orqenix-pro/blast-radius",
        version: "0.5.0",
        dependencies: { "@orqenix/core": "workspace:*" },
      },
    });

    const { execSync } = await import("node:child_process");
    execSync(
      `tsx scripts/convert-cross-scope-deps.ts --apply --oss-version=0.5.0 --version-range='~'`,
      { cwd: TMP }
    );

    const result = JSON.parse(
      await readFile(join(TMP, "packages/blast-radius/package.json"), "utf-8")
    );
    expect(result.dependencies["@orqenix/core"]).toBe("~0.5.0");
  });

  it("handles peerDependencies", async () => {
    await setupFixture({
      "blast-radius": {
        name: "@orqenix-pro/blast-radius",
        version: "0.5.0",
        peerDependencies: { "@orqenix/core": "workspace:^" },
      },
    });

    const { execSync } = await import("node:child_process");
    execSync(
      `tsx scripts/convert-cross-scope-deps.ts --apply --oss-version=0.5.0`,
      { cwd: TMP }
    );

    const result = JSON.parse(
      await readFile(join(TMP, "packages/blast-radius/package.json"), "utf-8")
    );
    expect(result.peerDependencies["@orqenix/core"]).toBe("^0.5.0");
  });
});
