#!/usr/bin/env node
/**
 * Detects drift between root package.json and pnpm-lock.yaml.
 * Exits 0 with stdout "IN_SYNC" if no drift.
 * Exits 1 with "DRIFT_DETECTED" and JSON details otherwise.
 * Exits 2 on precondition failure (missing files, parse errors).
 *
 * Usage: node scripts/release/check-lockfile-drift.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let parseYaml;
try {
  ({ parse: parseYaml } = require("yaml"));
} catch {
  console.error(
    "[check-lockfile-drift] 'yaml' package not found. Install with: npm install --no-save yaml@2",
  );
  process.exit(2);
}

const ROOT = process.cwd();
const PKG_PATH = resolve(ROOT, "package.json");
const LOCK_PATH = resolve(ROOT, "pnpm-lock.yaml");

function fail(msg) {
  console.error(`[check-lockfile-drift] ${msg}`);
  process.exit(2);
}

if (!existsSync(PKG_PATH)) fail("root package.json not found");
if (!existsSync(LOCK_PATH)) fail("pnpm-lock.yaml not found");

let pkg, lock;
try {
  pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
} catch (e) {
  fail(`failed to parse package.json: ${e.message}`);
}
try {
  lock = parseYaml(readFileSync(LOCK_PATH, "utf8"));
} catch (e) {
  fail(`failed to parse pnpm-lock.yaml: ${e.message}`);
}

const pkgDeps = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {}),
  ...(pkg.optionalDependencies ?? {}),
};

const rootImporter = lock?.importers?.["."] ?? {};
const lockSpecs = {};
for (const section of [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
]) {
  const entries = rootImporter[section] ?? {};
  for (const [name, info] of Object.entries(entries)) {
    lockSpecs[name] = typeof info === "string" ? info : info?.specifier;
  }
}

const drifted = [];

for (const [name, specifier] of Object.entries(pkgDeps)) {
  if (lockSpecs[name] !== specifier) {
    drifted.push({
      name,
      packageJson: specifier,
      lockfile: lockSpecs[name] ?? "<missing>",
    });
  }
}

for (const name of Object.keys(lockSpecs)) {
  if (!(name in pkgDeps)) {
    drifted.push({
      name,
      packageJson: "<missing>",
      lockfile: lockSpecs[name],
    });
  }
}

if (drifted.length === 0) {
  console.log("IN_SYNC");
  process.exit(0);
}

console.log("DRIFT_DETECTED");
console.log(JSON.stringify({ drifted }, null, 2));
process.exit(1);
