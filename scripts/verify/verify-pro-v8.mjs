// SPDX-License-Identifier: BUSL-1.1
// Phase 8 Pro repo verification. MUST run on milosaysyolo/Orqenix-Pro at
// branch phase-8/self-learning-pro, NOT on the Phase 5 baseline.
//
// Run from Orqenix-Pro repo root: node scripts/verify/verify-pro-v8.mjs

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const ROOT = process.cwd();

function preflight() {
  console.log('Pre-flight checks for Phase 8 Pro repo...\n');

  const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
  if (!branch.includes('phase-8') && !branch.includes('self-learning-pro')) {
    console.error('X Wrong branch: ' + branch + '. Expected phase-8/self-learning-pro.');
    process.exit(1);
  }
  console.log('OK Branch: ' + branch);

  const proPackages = [
    'packages/self-learning-advanced/package.json',
    'packages/cross-project-federation/package.json',
  ];
  for (const rel of proPackages) {
    if (!existsSync(rel)) {
      console.error('X Missing: ' + rel + '. Phase 8 Pro packages not shipped to this repo yet.');
      process.exit(1);
    }
    const pkg = JSON.parse(readFileSync(rel, 'utf-8'));
    if (!pkg.version.startsWith('0.8.')) {
      console.error('X Wrong version: ' + pkg.name + ' is ' + pkg.version + ', expected 0.8.x');
      process.exit(1);
    }
    console.log('OK ' + pkg.name + '@' + pkg.version);
  }

  for (const rel of proPackages) {
    const pkg = JSON.parse(readFileSync(rel, 'utf-8'));
    if (pkg.license !== 'BUSL-1.1') {
      console.error('X ' + pkg.name + ' license is ' + pkg.license + ', expected BUSL-1.1');
      process.exit(1);
    }
  }
  console.log('OK All Pro packages are BSL-1.1\n');
}

function step(label, cmd, args) {
  console.log('\n> ' + label);
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    timeout: 300000,
  });
  if (r.status !== 0) {
    console.error('X ' + label + ' FAILED (exit ' + r.status + ')');
    return false;
  }
  console.log('OK ' + label + ' passed');
  return true;
}

preflight();

const ossPath = '../Orqenix';
if (!existsSync(ossPath)) {
  console.error('X OSS sibling repo missing at ' + ossPath + '.');
  console.error('   Run unified cross-repo checkout first.');
  process.exit(1);
}

const results = {
  install: step('install', 'pnpm', ['install', '--prefer-frozen-lockfile']),
  typecheck: step('typecheck (Pro packages only)', 'pnpm', [
    '--filter', '@orqenix-pro/*', '-r', 'run', 'typecheck',
  ]),
  build: step('build (Pro packages only)', 'pnpm', [
    '--filter', '@orqenix-pro/*', '-r', 'run', 'build',
  ]),
  test: step('test (Pro packages only)', 'pnpm', [
    '--filter', '@orqenix-pro/*', '-r', 'run', 'test',
  ]),
};

console.log('\n== Phase 8 Pro Verification Summary ==');
for (const [s, ok] of Object.entries(results)) {
  console.log('  ' + (ok ? 'OK' : 'X') + ' ' + s);
}

process.exit(Object.values(results).every(Boolean) ? 0 : 1);
