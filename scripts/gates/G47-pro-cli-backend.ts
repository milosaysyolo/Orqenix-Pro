import {
  makeBackendStatusCommand,
  makeBackendSwitchCommand,
} from '../../packages/cli/src/subcommands/index.js';
import { ExitCode } from '../../packages/cli/src/exit-codes.js';
import { makeFormatter } from '../../packages/cli/src/formatters.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { AuditEntry, AuditLog } from '../../packages/cli/src/subcommands/delegation-store.js';
import type { BackendInfo, BackendManager } from '../../packages/cli/src/subcommands/backend-manager.js';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  const tag = ok ? 'PASS' : 'FAIL';
  if (!ok) failures++;
  console.log(`[G47-pro] ${tag}  ${name}${detail ? `  (${detail})` : ''}`);
}

function mkCtx(rest: string[]) {
  return {
    flags: { format: 'json' as const, verbose: false, noColor: true, configDir: '.orqenix' },
    formatter: makeFormatter('json'),
    configDir: '.orqenix',
    logger: { info() {}, warn() {}, error() {} } as unknown as { info: (...args: unknown[]) => void },
    metrics: { increment() {}, gauge() {}, timing() {} } as unknown as { increment: (...args: unknown[]) => void },
    license: { subject: 'scp_b3_gate' as ScopeId, tier: 'pro' as const, expiresAtMs: Date.now() + 60_000, jti: 'g' },
    rest,
  };
}

function fakeManager(init: BackendInfo[], probes: Record<string, boolean> = {}): BackendManager {
  const list = init.map((b) => ({ ...b }));
  return {
    async status() { return list; },
    async readinessProbe(k) { return probes[k] ?? list.find((b) => b.kind === k)?.ready ?? false; },
    async switch(k) {
      list.forEach((b) => { b.active = b.kind === k; });
      return list.find((b) => b.kind === k)!;
    },
  };
}

function chainedAudit(): { log: AuditLog; entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    log: {
      async append(input) {
        const prevHash = entries.at(-1)?.hash ?? '0'.repeat(64);
        const entry: AuditEntry = {
          index: entries.length, ts: Date.now(),
          type: input.type, actor: input.actor, subject: input.subject, details: input.details,
          hash: `h${entries.length}`.padStart(64, '0'), prevHash,
        };
        entries.push(entry); return entry;
      },
      async get(i) { return entries[i]; },
    },
  };
}

async function main(): Promise<void> {
  {
    const list: BackendInfo[] = [
      { kind: 'sqlite',  active: true,  ready: true,  version: '3.45' },
      { kind: 'lmdb',    active: false, ready: true,  version: '0.9' },
      { kind: 'kuzu',    active: false, ready: false, version: '0.4', lastError: 'graph store unreachable' },
      { kind: 'lancedb', active: false, ready: true,  version: '0.10' },
    ];
    const r = await makeBackendStatusCommand({ manager: fakeManager(list) }).run(mkCtx([]));
    const arr = r.payload as BackendInfo[];
    const allFour = arr.length === 4;
    const activeSqlite = arr.find((b) => b.kind === 'sqlite')?.active === true;
    const kuzuNotReady = arr.find((b) => b.kind === 'kuzu')?.ready === false;
    check('C1 backend status reports kinds + active + ready', r.exitCode === ExitCode.SUCCESS && allFour && activeSqlite && kuzuNotReady);
  }

  {
    const list: BackendInfo[] = [
      { kind: 'sqlite', active: true,  ready: true,  version: '3.45' },
      { kind: 'kuzu',   active: false, ready: false, version: '0.4',  lastError: 'graph store unreachable' },
      { kind: 'lmdb',   active: false, ready: true,  version: '0.9' },
    ];
    const manager = fakeManager(list);
    const { log, entries } = chainedAudit();

    const cmd = makeBackendSwitchCommand({ manager, audit: log });
    let refusedCode = 0;
    try { await cmd.run(mkCtx(['kuzu'])); } catch (e) { refusedCode = (e as { code: number }).code; }
    const refusedOk = refusedCode === ExitCode.GENERIC && entries.length === 0;

    const r2 = await cmd.run(mkCtx(['lmdb']));
    const acceptedOk = r2.exitCode === ExitCode.SUCCESS && entries.length === 1 && entries[0].type === 'backend.switch';

    check('C2 backend switch validates readiness + audits', refusedOk && acceptedOk);
  }

  if (failures > 0) {
    console.error(`[G47-pro] ${failures} criterion failures`);
    process.exit(1);
  }
  console.log('[G47-pro] ALL PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
