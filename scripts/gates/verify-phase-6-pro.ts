import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

interface Step {
  name: string;
  cmd: string;
  args: string[];
  skipEnv?: string;
  optionalEnv?: string;
}

const STEPS: Step[] = [
  { name: 'build (pnpm -r build)',          cmd: 'pnpm', args: ['-r', 'build'], skipEnv: 'SKIP_BUILD' },
  { name: 'test  (pnpm -r test)',           cmd: 'pnpm', args: ['-r', 'test'],  skipEnv: 'SKIP_TESTS' },
  { name: 'lint  no-DHT no-relay (Pro)',    cmd: process.execPath, args: ['--import', 'tsx', 'scripts/lint/no-dht-no-relay.ts'] },
  { name: 'G44-pro CLI Foundation',         cmd: process.execPath, args: ['--import', 'tsx', 'scripts/gates/G44-pro-cli-foundation.ts'] },
  { name: 'G45-pro Mesh + Delegation',      cmd: process.execPath, args: ['--import', 'tsx', 'scripts/gates/G45-pro-cli-mesh-delegation.ts'] },
  { name: 'G46-pro Quota Tools',            cmd: process.execPath, args: ['--import', 'tsx', 'scripts/gates/G46-pro-cli-quota.ts'] },
  { name: 'G47-pro Backend Tools',          cmd: process.execPath, args: ['--import', 'tsx', 'scripts/gates/G47-pro-cli-backend.ts'] },
  { name: 'OSS verify-phase-6 (optional)',  cmd: process.execPath, args: ['--import', 'tsx', '../Orqenix/scripts/gates/verify-phase-6.ts'], optionalEnv: 'ORQENIX_RUN_OSS_VERIFY' },
];

function runStep(s: Step): { ok: boolean; ms: number; skipped: boolean } {
  if (s.skipEnv && process.env[s.skipEnv] === '1') {
    console.log(`[verify-phase-6-pro] SKIP  ${s.name}  (${s.skipEnv}=1)`);
    return { ok: true, ms: 0, skipped: true };
  }
  if (s.optionalEnv && process.env[s.optionalEnv] !== '1') {
    console.log(`[verify-phase-6-pro] SKIP  ${s.name}  (${s.optionalEnv} not set)`);
    return { ok: true, ms: 0, skipped: true };
  }
  const t0 = performance.now();
  const r = spawnSync(s.cmd, s.args, { stdio: 'inherit', shell: false });
  const ms = performance.now() - t0;
  const ok = r.status === 0;
  console.log(`[verify-phase-6-pro] ${ok ? 'PASS' : 'FAIL'}  ${s.name}  (${ms.toFixed(0)}ms)`);
  return { ok, ms, skipped: false };
}

async function main(): Promise<void> {
  console.log('================================================================');
  console.log(' Orqenix Pro Phase 6 verify orchestrator (G44-pro to G47-pro)');
  console.log('================================================================');

  let total = 0;
  for (const s of STEPS) {
    const r = runStep(s);
    total += r.ms;
    if (!r.ok) {
      console.error(`[verify-phase-6-pro] FAILED at: ${s.name}`);
      console.error(`[verify-phase-6-pro] total elapsed before failure: ${(total / 1000).toFixed(2)}s`);
      process.exit(1);
    }
  }

  console.log('----------------------------------------------------------------');
  console.log(` Orqenix Pro Phase 6 verify: ALL GATES PASS  (total ${(total / 1000).toFixed(2)}s)`);
  console.log(' Pro repo is READY for tag v0.6.0-phase-6');
  console.log('================================================================');
}

main().catch((e) => { console.error(e); process.exit(1); });
