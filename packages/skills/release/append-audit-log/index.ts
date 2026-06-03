/**
 * Skill: append-audit-log
 *
 * Append entry to .orqenix/release-audit.log with BLAKE3 hash chain.
 * Compatible with Phase 5 Part 12A audit-log format.
 */

import { readFile, writeFile, appendFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { blake3 } from "@noble/hashes/blake3";
import { bytesToHex } from "@noble/hashes/utils";

export interface AuditEntry {
  timestamp: string;
  agent: string;
  action: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
}

export interface AppendInput {
  logPath: string;
  entry: AuditEntry;
}

export interface AppendOutput {
  entryHash: string;
  prevHash: string;
  chainPosition: number;
}

interface ChainedEntry extends AuditEntry {
  prev: string;
  hash: string;
  pos: number;
}

async function getLastHash(logPath: string): Promise<{ prev: string; pos: number }> {
  try {
    await access(logPath, constants.F_OK);
  } catch {
    return { prev: "0".repeat(64), pos: 0 };
  }

  const content = await readFile(logPath, "utf-8");
  const lines = content.trim().split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return { prev: "0".repeat(64), pos: 0 };

  const lastLine = lines[lines.length - 1];
  try {
    const parsed = JSON.parse(lastLine) as ChainedEntry;
    return { prev: parsed.hash, pos: parsed.pos };
  } catch {
    return { prev: "0".repeat(64), pos: 0 };
  }
}

function computeHash(entry: ChainedEntry): string {
  const { hash: _omit, ...content } = entry;
  const json = JSON.stringify(content);
  const bytes = new TextEncoder().encode(json);
  return bytesToHex(blake3(bytes));
}

export async function run(input: AppendInput): Promise<AppendOutput> {
  const { prev, pos } = await getLastHash(input.logPath);

  const chained: ChainedEntry = {
    ...input.entry,
    prev,
    pos: pos + 1,
    hash: "",
  };
  chained.hash = computeHash(chained);

  await appendFile(input.logPath, JSON.stringify(chained) + "\n", "utf-8");

  return {
    entryHash: chained.hash,
    prevHash: prev,
    chainPosition: chained.pos,
  };
}

/**
 * Verify the entire chain is intact.
 */
export async function verifyChain(logPath: string): Promise<{ valid: boolean; tamperedAt?: number }> {
  const content = await readFile(logPath, "utf-8");
  const lines = content.trim().split("\n").filter((l) => l.length > 0);

  let expectedPrev = "0".repeat(64);
  let expectedPos = 0;

  for (const line of lines) {
    const entry = JSON.parse(line) as ChainedEntry;
    expectedPos++;

    if (entry.prev !== expectedPrev) {
      return { valid: false, tamperedAt: expectedPos };
    }
    if (entry.pos !== expectedPos) {
      return { valid: false, tamperedAt: expectedPos };
    }
    const recomputed = computeHash(entry);
    if (recomputed !== entry.hash) {
      return { valid: false, tamperedAt: expectedPos };
    }
    expectedPrev = entry.hash;
  }

  return { valid: true };
}
