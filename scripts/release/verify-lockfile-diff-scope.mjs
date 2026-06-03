#!/usr/bin/env node
import { execSync } from "node:child_process";

const ALLOWED_FILES = new Set(["pnpm-lock.yaml", "package.json"]);

let staged;
try {
  staged = execSync("git diff --cached --name-only", { encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
} catch (e) {
  console.error("Failed to read git staged files:", e.message);
  process.exit(2);
}

const unauthorized = staged.filter((f) => !ALLOWED_FILES.has(f));

if (unauthorized.length === 0) {
  console.log("DIFF_SCOPE_OK");
  process.exit(0);
}

console.error("DIFF_SCOPE_VIOLATION");
console.error("Unauthorized files in staged diff:");
unauthorized.forEach((f) => console.error(`  - ${f}`));
console.error("\nOnly pnpm-lock.yaml and root package.json may be modified by the lockfile-sync agent.");
process.exit(1);
