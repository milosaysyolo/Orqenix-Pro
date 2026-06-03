#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const PKG_PATH = resolve(ROOT, "package.json");
const LOCK_PATH = resolve(ROOT, "pnpm-lock.yaml");

function fail(msg) {
  console.error(`[check-lockfile-drift] ${msg}`);
  process.exit(2);
}

if (!existsSync(PKG_PATH)) fail("root package.json not found");
if (!existsSync(LOCK_PATH)) fail("pnpm-lock.yaml not found");

const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
const lock = parseYaml(readFileSync(LOCK_PATH, "utf8"));

const pkgDeps = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {}),
  ...(pkg.optionalDependencies ?? {}),
};

const rootImporter = lock?.importers?.["."] ?? {};
const lockSpecs = {};
for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
  const entries = rootImporter[section] ?? {};
  for (const [name, info] of Object.entries(entries)) {
    lockSpecs[name] = info?.specifier ?? info;
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
} else {
  console.log("DRIFT_DETECTED");
  console.log(JSON.stringify({ drifted }, null, 2));
  process.exit(1);
}
