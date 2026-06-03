#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_ALLOWLIST = ["better-sqlite3", "esbuild", "@swc/core"];

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
const actual = pkg?.pnpm?.onlyBuiltDependencies ?? [];

const expectedSet = new Set(EXPECTED_ALLOWLIST);
const actualSet = new Set(actual);

const missing = [...expectedSet].filter((x) => !actualSet.has(x));
const extra = [...actualSet].filter((x) => !expectedSet.has(x));

if (missing.length === 0 && extra.length === 0) {
  console.log("ALLOWLIST_OK");
  process.exit(0);
}

console.error("ALLOWLIST_DRIFT");
console.error(JSON.stringify({ missing, extra, expected: EXPECTED_ALLOWLIST, actual }, null, 2));
process.exit(1);
