import { describe, it, expect } from 'vitest';
import { makeQuotaSetCommand } from '../../src/subcommands/quota-set.js';
import { ExitCode, UsageError } from '../../src/exit-codes.js';
import { makeFormatter } from '../../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { AuditEntry, AuditLog } from '../../src/subcommands/delegation-store.js';
import type { Quota, QuotaStore } from '../../src/subcommands/quota-store.js';

function fakeStore(): { store: QuotaStore; map: Map<string, Quota> } {
  const map = new Map<string, Quota>();
  map.set('rpc_calls_per_min', {
    kind: 'rpc_calls_per_min', scope: 'scp_b3_a' as ScopeId,
    current: 0, limit: 100, windowMs: 60_000, windowRemainingMs: 60_000,
    breached: false, windowStartedAtMs: Date.now(),
  });
  const store: QuotaStore = {
    async listQuotas() { return [...map.values()]; },
    async getQuota(_s, k) { return map.get(k); },
    async setLimit(_s, k, limit) {
      const e = map.get(k)!; const upd = { ...e, limit, breached: e.current >= limit };
      map.set(k, upd); return upd;
    },
    async resetWindow(_s, k) {
      const e = map.get(k)!; const upd = { ...e, current: 0 }; map.set(k, upd); return upd;
    },
  };
  return { store, map };
}

function fakeAudit(): { log: AuditLog; entries: AuditEntry[] } {
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

function mkCtx(rest: string[]) {
  return {
    flags: { format: 'json' as const, verbose: false, noColor: true, configDir: '.orqenix' },
    formatter: makeFormatter('json'),
    configDir: '.orqenix',
    logger: new MeshLogger({ level: 'info' }),
    metrics: new MeshMetrics(),
    license: { subject: 'scp_b3_a' as ScopeId, tier: 'pro' as const, expiresAtMs: Date.now() + 60_000, jti: 'j' },
    rest,
  };
}

describe('quota set', () => {
  it('updates the limit and writes an audit entry of type quota.set', async () => {
    const { store, map } = fakeStore();
    const { log, entries } = fakeAudit();
    const cmd = makeQuotaSetCommand({ store, audit: log });
    const r = await cmd.run(mkCtx(['rpc_calls_per_min', '--limit', '500']));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
    expect(map.get('rpc_calls_per_min')!.limit).toBe(500);
    expect(entries[0].type).toBe('quota.set');
    expect(entries[0].details.new_limit).toBe(500);
  });

  it('rejects unknown kind with UsageError', async () => {
    const { store } = fakeStore();
    const { log } = fakeAudit();
    const cmd = makeQuotaSetCommand({ store, audit: log });
    await expect(cmd.run(mkCtx(['unknown_kind', '--limit', '1']))).rejects.toBeInstanceOf(UsageError);
  });

  it('rejects missing --limit with UsageError', async () => {
    const { store } = fakeStore();
    const { log } = fakeAudit();
    const cmd = makeQuotaSetCommand({ store, audit: log });
    await expect(cmd.run(mkCtx(['rpc_calls_per_min']))).rejects.toBeInstanceOf(UsageError);
  });

  it('rejects --limit out of bounds with UsageError', async () => {
    const { store } = fakeStore();
    const { log } = fakeAudit();
    const cmd = makeQuotaSetCommand({ store, audit: log });
    await expect(cmd.run(mkCtx(['rpc_calls_per_min', '--limit', '100000000']))).rejects.toBeInstanceOf(UsageError);
  });
});
