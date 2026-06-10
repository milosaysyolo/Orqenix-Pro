import { describe, it, expect } from 'vitest';
import { makeDelegationRevokeCommand } from '../../src/subcommands/delegation-revoke.js';
import { makeQuotaSetCommand } from '../../src/subcommands/quota-set.js';
import { makeQuotaResetCommand } from '../../src/subcommands/quota-reset.js';
import { makeBackendSwitchCommand } from '../../src/subcommands/backend-switch.js';
import { makeFormatter } from '../../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { AuditEntry, AuditLog, Delegation, DelegationStore } from '../../src/subcommands/delegation-store.js';
import type { Quota, QuotaStore } from '../../src/subcommands/quota-store.js';
import type { BackendInfo, BackendManager } from '../../src/subcommands/backend-manager.js';

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

function delStore(): DelegationStore {
  const d: Delegation = {
    jti: 'jti-a', issuer: 'scp_b3_X' as ScopeId, subject: 'scp_b3_a' as ScopeId,
    caps: ['x'], expiresAtMs: Date.now() + 60_000, revoked: false, createdAtMs: Date.now(),
  };
  const map = new Map([[d.jti, d]]);
  return {
    async listForScope() { return [...map.values()]; },
    async get(jti) { return map.get(jti); },
    async chain() { return []; },
    async revoke(jti, reason) {
      const e = map.get(jti)!; const upd = { ...e, revoked: true, revokedReason: reason };
      map.set(jti, upd); return upd;
    },
  };
}

function qStore(): QuotaStore {
  const q: Quota = {
    kind: 'rpc_calls_per_min', scope: 'scp_b3_a' as ScopeId,
    current: 5, limit: 100, windowMs: 60_000, windowRemainingMs: 30_000,
    breached: false, windowStartedAtMs: Date.now(),
  };
  const map = new Map([[q.kind, q]]);
  return {
    async listQuotas() { return [...map.values()]; },
    async getQuota(_s, k) { return map.get(k); },
    async setLimit(_s, k, limit) { const e = map.get(k)!; const u = { ...e, limit }; map.set(k, u); return u; },
    async resetWindow(_s, k) { const e = map.get(k)!; const u = { ...e, current: 0 }; map.set(k, u); return u; },
  };
}

function bMgr(): BackendManager {
  const list: BackendInfo[] = [
    { kind: 'sqlite', active: true,  ready: true },
    { kind: 'lmdb',   active: false, ready: true },
  ];
  return {
    async status() { return list; },
    async readinessProbe() { return true; },
    async switch(k) {
      list.forEach((b) => { b.active = b.kind === k; });
      return list.find((b) => b.kind === k)!;
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

describe('unified audit stream across Parts 11B + 12', () => {
  it('produces four hash-chained entries across all four mutation types', async () => {
    const store = delStore();
    const quotas = qStore();
    const backends = bMgr();
    const { log, entries } = chainedAudit();

    const cRevoke = makeDelegationRevokeCommand({ store, audit: log });
    const cSet    = makeQuotaSetCommand({ store: quotas, audit: log });
    const cReset  = makeQuotaResetCommand({ store: quotas, audit: log });
    const cSwitch = makeBackendSwitchCommand({ manager: backends, audit: log });

    await cRevoke.run(mkCtx(['jti-a', '--reason', 'rotation policy applied']));
    await cSet.run(mkCtx(['rpc_calls_per_min', '--limit', '500']));
    await cReset.run(mkCtx(['rpc_calls_per_min']));
    await cSwitch.run(mkCtx(['lmdb']));

    expect(entries.map((e) => e.type)).toEqual([
      'delegation.revoke',
      'quota.set',
      'quota.reset',
      'backend.switch',
    ]);
    expect(entries[0].prevHash).toBe('0'.repeat(64));
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].prevHash).toBe(entries[i - 1].hash);
    }
  });
});
