import { describe, it, expect } from 'vitest';
import { makeQuotaShowCommand } from '../../src/subcommands/quota-show.js';
import { ExitCode } from '../../src/exit-codes.js';
import { makeFormatter } from '../../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { Quota, QuotaKind, QuotaStore } from '../../src/subcommands/quota-store.js';

function mkQuota(kind: QuotaKind, over: Partial<Quota> = {}): Quota {
  return {
    kind, scope: 'scp_b3_a' as ScopeId,
    current: 12, limit: 100, windowMs: 60_000, windowRemainingMs: 30_000,
    breached: false, windowStartedAtMs: Date.now() - 30_000,
    ...over,
  };
}

function fakeStore(quotas: Quota[]): QuotaStore {
  const map = new Map(quotas.map((q) => [q.kind, q]));
  return {
    async listQuotas() { return [...map.values()]; },
    async getQuota(_s, k) { return map.get(k); },
    async setLimit(_s, k, limit) {
      const e = map.get(k)!; const upd = { ...e, limit, breached: e.current >= limit };
      map.set(k, upd); return upd;
    },
    async resetWindow(_s, k) {
      const e = map.get(k)!; const upd = { ...e, current: 0, windowRemainingMs: e.windowMs, windowStartedAtMs: Date.now() };
      map.set(k, upd); return upd;
    },
  };
}

function mkCtx(format: 'json' | 'table' = 'table') {
  return {
    flags: { format, verbose: false, noColor: true, configDir: '.orqenix' },
    formatter: makeFormatter(format),
    configDir: '.orqenix',
    logger: new MeshLogger({ level: 'info' }),
    metrics: new MeshMetrics(),
    license: { subject: 'scp_b3_a' as ScopeId, tier: 'pro' as const, expiresAtMs: Date.now() + 60_000, jti: 'j' },
    rest: [],
  };
}

describe('quota show', () => {
  it('returns table rows for all configured quotas', async () => {
    const store = fakeStore([mkQuota('rpc_calls_per_min'), mkQuota('delegations_active', { breached: true, current: 200, limit: 100 })]);
    const cmd = makeQuotaShowCommand({ store });
    const r = await cmd.run(mkCtx('table'));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
    expect((r.payload as Array<{ kind: string }>)).toHaveLength(2);
    expect(r.columns).toContain('breached');
  });

  it('returns full Quota objects in json mode', async () => {
    const store = fakeStore([mkQuota('rpc_calls_per_min')]);
    const cmd = makeQuotaShowCommand({ store });
    const r = await cmd.run(mkCtx('json'));
    expect((r.payload as Quota[])[0].windowMs).toBe(60_000);
  });

  it('handles empty quota list', async () => {
    const cmd = makeQuotaShowCommand({ store: fakeStore([]) });
    const r = await cmd.run(mkCtx('table'));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
    expect((r.payload as unknown[]).length).toBe(0);
  });
});
