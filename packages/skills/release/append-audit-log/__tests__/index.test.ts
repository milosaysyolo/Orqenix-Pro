import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run, verifyChain } from "../index";

let tmpDir: string;
let logPath: string;

describe("append-audit-log", () => {
  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "audit-"));
    logPath = join(tmpDir, "audit.log");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("appends first entry with zero prev hash", async () => {
    const result = await run({
      logPath,
      entry: {
        timestamp: "2026-06-03T10:00:00Z",
        agent: "release-lead",
        action: "test",
        inputs: { test: 1 },
      },
    });
    expect(result.prevHash).toBe("0".repeat(64));
    expect(result.chainPosition).toBe(1);
    expect(result.entryHash).toHaveLength(64);
  });

  it("chains entries correctly", async () => {
    const r1 = await run({
      logPath,
      entry: {
        timestamp: "2026-06-03T10:00:00Z",
        agent: "release-lead",
        action: "first",
        inputs: {},
      },
    });
    const r2 = await run({
      logPath,
      entry: {
        timestamp: "2026-06-03T10:01:00Z",
        agent: "release-lead",
        action: "second",
        inputs: {},
      },
    });
    expect(r2.prevHash).toBe(r1.entryHash);
    expect(r2.chainPosition).toBe(2);
  });

  it("verifies intact chain", async () => {
    await run({ logPath, entry: { timestamp: "t1", agent: "a", action: "a1", inputs: {} } });
    await run({ logPath, entry: { timestamp: "t2", agent: "a", action: "a2", inputs: {} } });
    await run({ logPath, entry: { timestamp: "t3", agent: "a", action: "a3", inputs: {} } });
    const result = await verifyChain(logPath);
    expect(result.valid).toBe(true);
  });

  it("detects tampering", async () => {
    await run({ logPath, entry: { timestamp: "t1", agent: "a", action: "a1", inputs: {} } });
    await run({ logPath, entry: { timestamp: "t2", agent: "a", action: "a2", inputs: {} } });

    const content = await readFile(logPath, "utf-8");
    const tampered = content.replace('"action":"a2"', '"action":"hacked"');
    await writeFile(logPath, tampered);

    const result = await verifyChain(logPath);
    expect(result.valid).toBe(false);
    expect(result.tamperedAt).toBe(2);
  });

  it("detects chain break", async () => {
    await run({ logPath, entry: { timestamp: "t1", agent: "a", action: "a1", inputs: {} } });
    await run({ logPath, entry: { timestamp: "t2", agent: "a", action: "a2", inputs: {} } });
    await run({ logPath, entry: { timestamp: "t3", agent: "a", action: "a3", inputs: {} } });

    const content = await readFile(logPath, "utf-8");
    const lines = content.trim().split("\n");
    await writeFile(logPath, lines[0] + "\n" + lines[2] + "\n");

    const result = await verifyChain(logPath);
    expect(result.valid).toBe(false);
  });
});
