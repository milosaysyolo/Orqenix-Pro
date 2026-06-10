import {
  makeQuotaShowCommand,
  makeQuotaSetCommand,
  makeQuotaResetCommand,
} from '../../packages/cli/src/subcommands/index.js';
import { ExitCode } from '../../packages/cli/src/exit-codes.js';
import { makeFormatter } from '../../packages/cli/src/formatters.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { AuditEntry, AuditLog } from '../../packages/cli/src/subcommands/delegation-store.js';
import type { Quota, QuotaStore } from '../../packages/cli/src/subcommands/quota-store.js';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  const tag = ok ? 'PASS' : 'FAIL';
  if (!ok) failures++;
  console.log(`[G46-pro] ${tag}  ${name}${detail ? `  (${detail})` : ''}`);
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

function fakeStore(seed: Quota[]): { store: QuotaStore; map: Map<string, Quota> } {
  const map = new Map(seed.map((q) => [q.kind, q]));
  return {
    map,
    store: {
      async listQuotas() { return [...map.values()]; },
      async getQuota(_s, k) { return map.get(k); },
      async setLimit(_s, k, limit) {
        const e = map.get(k)!; const u = { ...e, limit, breached: e.current >= limit };
        map.set(k, u); return u;
      },
      async resetWindow(_s, k) {
        const e = map.get(k)!; const u = { ...e, current: 0, windowRemainingMs: e.windowMs, windowStartedAtMs: Date.now() };
        map.set(k, u); return u;
      },
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
    const { store } = fakeStore([
      {
        kind: 'rpc_calls_per_min', scope: 'scp_b3_gate' as ScopeId,
        current: 12, limit: 100, windowMs: 60_000, windowRemainingMs: 30_000,
        breached: false, windowStartedAtMs: Date.now() - 30_000,
      },
      {
        kind: 'delegations_active', scope: 'scp_b3_gate' as ScopeId,
        current: 200, limit: 100, windowMs: 60_000, windowRemainingMs: 0,
        breached: true, windowStartedAtMs: Date.now() - 60_000,
      },
    ]);
    const r = await makeQuotaShowCommand({ store }).run(mkCtx([]));
    const arr = r.payload as Quota[];
    const okCount = arr.length === 2;
    const hasFields = arr[0].current !== undefined && arr[0].limit !== undefined;
    const hasBreach = arr.some((q) => q.breached === true);
    check('C1 quota show reports current/limit/breach', r.exitCode === ExitCode.SUCCESS && okCount && hasFields && hasBreach);
  }

  {
    const { store, map } = fakeStore([
      {
        kind: 'rpc_calls_per_min', scope: 'scp_b3_gate' as ScopeId,
        current: 12, limit: 100, windowMs: 60_000, windowRemainingMs: 30_000,
        breached: false, windowStartedAtMs: Date.now(),
      },
    ]);
    const { log, entries } = chainedAudit();
    const r = await makeQuotaSetCommand({ store, audit: log }).run(mkCtx(['rpc_calls_per_min', '--limit', '500']));
    const limitUpdated = map.get('rpc_calls_per_min')!.limit === 500;
    const auditOk = entries.length === 1 && entries[0].type === 'quota.set' && entries[0].details.new_limit === 500;
    check('C2 quota set updates + audits', r.exitCode === ExitCode.SUCCESS && limitUpdated && auditOk);
  }

  {
    const { store } = fakeStore([
      {
        kind: 'recall_queries_per_min', scope: 'scp_b3_gate' as ScopeId,
        current: 0, limit: 10, windowMs: 60_000, windowRemainingMs: 60_000,
        breached: false, windowStartedAtMs: Date.now(),
      },
    ]);
    const { log, entries } = chainedAudit();
    await makeQuotaSetCommand({ store, audit: log }).run(mkCtx(['recall_queries_per_min', '--limit', '20']));
    await makeQuotaResetCommand({ store, audit: log }).run(mkCtx(['recall_queries_per_min']));
    const chained = entries.length === 2 && entries[1].prevHash === entries[0].hash;
    check('C3 concurrent set + reset audit chain intact', chained);
  }

  if (failures > 0) {
    console.error(`[G46-pro] ${failures} criterion failures`);
    process.exit(1);
  }
  console.log('[G46-pro] ALL PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
