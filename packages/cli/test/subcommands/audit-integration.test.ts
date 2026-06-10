import { describe, it, expect } from 'vitest';
import { makeDelegationRevokeCommand } from '../../src/subcommands/delegation-revoke.js';
import { makeFormatter } from '../../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import { ExitCode } from '../../src/exit-codes.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { AuditEntry, AuditLog, Delegation, DelegationStore } from '../../src/subcommands/delegation-store.js';

function fakeStore(seed: Delegation[]): DelegationStore {
  const map = new Map(seed.map((d) => [d.jti, d]));
  return {
    async listForScope() { return [...map.values()]; },
    async get(jti) { return map.get(jti); },
    async chain() { return []; },
    async revoke(jti, reason) {
      const e = map.get(jti);
      if (!e) throw new Error('not found');
      const upd = { ...e, revoked: true, revokedReason: reason };
      map.set(jti, upd);
      return upd;
    },
  };
}

function chainedAudit(): { log: AuditLog; entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  const log: AuditLog = {
    async append(input) {
      const prevHash = entries.at(-1)?.hash ?? '0'.repeat(64);
      const hash = `h${entries.length}`.padStart(64, '0');
      const entry: AuditEntry = {
        index: entries.length,
        ts: Date.now(),
        type: input.type,
        actor: input.actor,
        subject: input.subject,
        details: input.details,
        hash,
        prevHash,
      };
      entries.push(entry);
      return entry;
    },
    async get(i) { return entries[i]; },
  };
  return { log, entries };
}

function mkDel(jti: string): Delegation {
  return {
    jti,
    issuer: 'scp_b3_B' as ScopeId,
    subject: 'scp_b3_A' as ScopeId,
    caps: ['memory.query'],
    expiresAtMs: Date.now() + 60_000,
    revoked: false,
    createdAtMs: Date.now() - 10_000,
  };
}

function mkCtx(rest: string[]) {
  return {
    flags: { format: 'json' as const, verbose: false, noColor: true, configDir: '.orqenix' },
    formatter: makeFormatter('json'),
    configDir: '.orqenix',
    logger: new MeshLogger({ level: 'info' }),
    metrics: new MeshMetrics(),
    license: { subject: 'scp_b3_A' as ScopeId, tier: 'pro' as const, expiresAtMs: Date.now() + 60_000, jti: 'j' },
    rest,
  };
}

describe('audit hash-chain integrity across two revokes', () => {
  it('second entry.prevHash equals first entry.hash', async () => {
    const store = fakeStore([mkDel('jti-1'), mkDel('jti-2')]);
    const { log, entries } = chainedAudit();
    const cmd = makeDelegationRevokeCommand({ store, audit: log });

    const a = await cmd.run(mkCtx(['jti-1', '--reason', 'rotation policy applied']));
    const b = await cmd.run(mkCtx(['jti-2', '--reason', 'rotation policy applied']));

    expect(a.exitCode).toBe(ExitCode.SUCCESS);
    expect(b.exitCode).toBe(ExitCode.SUCCESS);
    expect(entries.length).toBe(2);
    expect(entries[0].prevHash).toBe('0'.repeat(64));
    expect(entries[1].prevHash).toBe(entries[0].hash);
  });
});
