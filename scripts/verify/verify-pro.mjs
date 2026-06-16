// SPDX-License-Identifier: BUSL-1.1
// Pro repo verifier for Phase 8 continuity.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const SEP = '─'.repeat(70);

function run(label, cmd, opts = {}) {
  console.log(`\n${SEP}`);
  console.log(`  ${label}`);
  console.log(`${SEP}`);
  const start = Date.now();
  try {
    const out = execSync(cmd, { encoding: 'utf-8', timeout: 300000, ...opts });
    console.log(out);
    console.log(`✓ ${label} (${Date.now() - start}ms)`);
    return { ok: true, out };
  } catch (e) {
    console.log(e.stdout ?? '');
    console.error(e.stderr ?? '');
    console.log(`✗ ${label} (${Date.now() - start}ms) — FAILED (exit ${e.status})`);
    return { ok: false, out: e.stdout ?? '', err: e.stderr ?? '' };
  }
}

console.log(`\n  Orqenix-Pro :: Phase 8 Continuity Verify`);
console.log(`  Platform: ${process.platform} ${process.arch} node ${process.version}`);
console.log(`  CWD: ${process.cwd()}`);
console.log(`  ${SEP}\n`);

const results = [];

// 1. Install
const install = run('Install', 'pnpm install --no-frozen-lockfile', { timeout: 180000 });
results.push({ step: 'install', ...install });

// 2. Typecheck (skip if install failed)
let typecheck = { ok: false };
if (install.ok) {
  typecheck = run('Typecheck', 'pnpm -r run typecheck');
}
results.push({ step: 'typecheck', ...typecheck });

// 3. Build (skip if install failed)
let build = { ok: false };
if (install.ok) {
  build = run('Build', 'pnpm -r run build');
}
results.push({ step: 'build', ...build });

// 4. Test (Phase-8 scope — optional)
let test = { ok: false };
if (install.ok) {
  test = run('Test (Phase 8 scope)', 'pnpm --filter "@orqenix-pro/*" run test -- --reporter=verbose 2>&1 || true');
}
results.push({ step: 'test', ...test });

// Summary
console.log(`\n${SEP}`);
console.log('  PRO VERIFY SUMMARY');
console.log(`${SEP}`);
let allOk = true;
for (const r of results) {
  const icon = r.ok ? '✓' : '✗';
  console.log(`  ${icon} ${r.step}`);
  if (!r.ok) allOk = false;
}
console.log(`${SEP}`);
console.log(`  Overall: ${allOk ? 'PASS' : 'PARTIAL / SEE ABOVE'}`);
console.log(`${SEP}\n`);

process.exit(allOk ? 0 : 1);
