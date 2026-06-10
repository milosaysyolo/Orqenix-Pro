import { describe, it, expect, vi } from 'vitest';
import { makeDelegationRevokeCommand } from '../../src/subcommands/delegation-revoke.js';
import { ExitCode, NotFoundError, UsageError } from '../../src/exit-codes.js';
import { makeFormatter } from '../../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { AuditEntry, AuditLog, Delegation, DelegationStore } from '../../src/subcommands/delegation-store.js';

function mkDel(over: Partial<Delegation> = {}): Delegation {
  return {
    jti: over.jti ?? 'jti-x',
    issuer: 'scp_b3_B' as ScopeId,
    subject: 'scp_b3_A' as ScopeId,
    caps: ['memory.query'],
    expiresAtMs: Date.now() + 60_000,
    revoked: false,
    createdAtMs: Date.now() - 10_000,
    ...over,
  };
}

function mkStore(initial: Delegation[]): DelegationStore {
  const map = new Map(initial.map((d) => [d.jti, d]));
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

function mkAuditLog(): { log: AuditLog; entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  let index = 0;
  const log: AuditLog = {
    async append(input) {
      const prevHash = entries.at(-1)?.hash ?? '0'.repeat(64);
      const entry: AuditEntry = {
        index: index++,
        ts: Date.now(),
        type: input.type,
        actor: input.actor,
        subject: input.subject,
        details: input.details,
        hash: 'h'.repeat(64),
        prevHash,
      };
      entries.push(entry);
      return entry;
    },
    async get(i) { return entries[i]; },
  };
  return { log, entries };
}

function mkCtx(rest: string[], format: 'json' | 'table' | 'plain' = 'table') {
  return {
    flags: { format, verbose: false, noColor: true, configDir: '.orqenix' },
    formatter: makeFormatter(format),
    configDir: '.orqenix',
    logger: new MeshLogger({ level: 'info' }),
    metrics: new MeshMetrics(),
    license: { subject: 'scp_b3_A' as ScopeId, tier: 'pro' as const, expiresAtMs: Date.now() + 60_000, jti: 'j' },
    rest,
  };
}

describe('delegation revoke', () => {
  it('revokes and writes a single audit entry', async () => {
    const store = mkStore([mkDel({ jti: 'jti-x' })]);
    const { log, entries } = mkAuditLog();
    const cmd = makeDelegationRevokeCommand({ store, audit: log });

    const r = await cmd.run(mkCtx(['jti-x', '--reason', 'compromised key']));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
    expect(entries.length).toBe(1);
    expect(entries[0].type).toBe('delegation.revoke');
    expect(entries[0].subject).toBe('jti-x');
    expect(entries[0].details.reason).toBe('compromised key');
  });

  it('rejects missing --reason with UsageError', async () => {
    const store = mkStore([mkDel({ jti: 'jti-x' })]);
    const { log } = mkAuditLog();
    const cmd = makeDelegationRevokeCommand({ store, audit: log });
    await expect(cmd.run(mkCtx(['jti-x']))).rejects.toBeInstanceOf(UsageError);
  });

  it('rejects short reason with UsageError', async () => {
    const store = mkStore([mkDel({ jti: 'jti-x' })]);
    const { log } = mkAuditLog();
    const cmd = makeDelegationRevokeCommand({ store, audit: log });
    await expect(cmd.run(mkCtx(['jti-x', '--reason', 'short']))).rejects.toBeInstanceOf(UsageError);
  });

  it('throws NotFoundError on unknown jti', async () => {
    const store = mkStore([]);
    const { log } = mkAuditLog();
    const cmd = makeDelegationRevokeCommand({ store, audit: log });
    await expect(cmd.run(mkCtx(['jti-missing', '--reason', 'reason long enough'])))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('is idempotent on already-revoked entries without appending a new audit entry', async () => {
    const store = mkStore([mkDel({ jti: 'jti-x', revoked: true, revokedReason: 'prior' })]);
    const { log, entries } = mkAuditLog();
    const cmd = makeDelegationRevokeCommand({ store, audit: log });
    const r = await cmd.run(mkCtx(['jti-x', '--reason', 'second time around']));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
    expect(entries.length).toBe(0);
    expect((r.payload as { already_revoked: boolean }).already_revoked).toBe(true);
  });

  it('returns json with audit_index and audit_hash for traceability', async () => {
    const store = mkStore([mkDel({ jti: 'jti-x' })]);
    const { log } = mkAuditLog();
    const cmd = makeDelegationRevokeCommand({ store, audit: log });
    const r = await cmd.run(mkCtx(['jti-x', '--reason', 'long enough reason'], 'json'));
    const p = r.payload as { audit_index: number; audit_hash: string; prev_hash: string };
    expect(p.audit_index).toBe(0);
    expect(p.audit_hash).toMatch(/^h+$/);
    expect(p.prev_hash).toBe('0'.repeat(64));
  });

  it('does not call audit.append when revoke fails', async () => {
    const store: DelegationStore = {
      async listForScope() { return []; },
      async get() { return mkDel({ jti: 'jti-x' }); },
      async chain() { return []; },
      async revoke() { throw new Error('storage down'); },
    };
    const { log, entries } = mkAuditLog();
    const spy = vi.spyOn(log, 'append');
    const cmd = makeDelegationRevokeCommand({ store, audit: log });
    await expect(cmd.run(mkCtx(['jti-x', '--reason', 'long enough reason']))).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
    expect(entries.length).toBe(0);
  });
});
