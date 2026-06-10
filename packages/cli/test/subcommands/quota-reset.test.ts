import { describe, it, expect } from 'vitest';
import { makeQuotaResetCommand } from '../../src/subcommands/quota-reset.js';
import { ExitCode, UsageError } from '../../src/exit-codes.js';
import { makeFormatter } from '../../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { AuditEntry, AuditLog } from '../../src/subcommands/delegation-store.js';
import type { Quota, QuotaStore } from '../../src/subcommands/quota-store.js';

function fakeStore(): { store: QuotaStore; map: Map<string, Quota> } {
  const map = new Map<string, Quota>();
  map.set('recall_queries_per_min', {
    kind: 'recall_queries_per_min', scope: 'scp_b3_a' as ScopeId,
    current: 88, limit: 100, windowMs: 60_000, windowRemainingMs: 10_000,
    breached: false, windowStartedAtMs: Date.now() - 50_000,
  });
  const store: QuotaStore = {
    async listQuotas() { return [...map.values()]; },
    async getQuota(_s, k) { return map.get(k); },
    async setLimit() { throw new Error('not used'); },
    async resetWindow(_s, k) {
      const e = map.get(k)!;
      const upd = { ...e, current: 0, windowRemainingMs: e.windowMs, windowStartedAtMs: Date.now() };
      map.set(k, upd); return upd;
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

describe('quota reset', () => {
  it('resets current to 0 and appends audit entry of type quota.reset', async () => {
    const { store, map } = fakeStore();
    const { log, entries } = fakeAudit();
    const cmd = makeQuotaResetCommand({ store, audit: log });
    const r = await cmd.run(mkCtx(['recall_queries_per_min']));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
    expect(map.get('recall_queries_per_min')!.current).toBe(0);
    expect(entries[0].type).toBe('quota.reset');
    expect(entries[0].details.reason).toBeNull();
  });

  it('accepts --reason when 8-240 chars and records it in audit details', async () => {
    const { store } = fakeStore();
    const { log, entries } = fakeAudit();
    const cmd = makeQuotaResetCommand({ store, audit: log });
    await cmd.run(mkCtx(['recall_queries_per_min', '--reason', 'manual ops reset after misconfig']));
    expect(entries[0].details.reason).toBe('manual ops reset after misconfig');
  });

  it('rejects short --reason with UsageError', async () => {
    const { store } = fakeStore();
    const { log } = fakeAudit();
    const cmd = makeQuotaResetCommand({ store, audit: log });
    await expect(cmd.run(mkCtx(['recall_queries_per_min', '--reason', 'short']))).rejects.toBeInstanceOf(UsageError);
  });

  it('rejects unknown quota kind', async () => {
    const { store } = fakeStore();
    const { log } = fakeAudit();
    const cmd = makeQuotaResetCommand({ store, audit: log });
    await expect(cmd.run(mkCtx(['bogus_kind']))).rejects.toBeInstanceOf(UsageError);
  });
});
