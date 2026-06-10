import { describe, it, expect } from 'vitest';
import { makeDelegationChainShowCommand } from '../../src/subcommands/delegation-chain-show.js';
import { ExitCode, NotFoundError } from '../../src/exit-codes.js';
import { makeFormatter } from '../../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { Delegation, DelegationStore } from '../../src/subcommands/delegation-store.js';

function mkDel(over: Partial<Delegation> = {}): Delegation {
  return {
    jti: over.jti ?? 'jti-0',
    issuer: 'scp_b3_B' as ScopeId,
    subject: 'scp_b3_A' as ScopeId,
    caps: ['memory.query'],
    expiresAtMs: Date.now() + 60_000,
    revoked: false,
    createdAtMs: Date.now() - 10_000,
    ...over,
  };
}

function mkStore(seed: Delegation[]): DelegationStore {
  const map = new Map(seed.map((d) => [d.jti, d]));
  return {
    async listForScope() { return seed; },
    async get(jti) { return map.get(jti); },
    async chain(jti) {
      const out: Delegation[] = [];
      let cur = map.get(jti);
      while (cur) {
        out.push(cur);
        cur = cur.parentJti ? map.get(cur.parentJti) : undefined;
      }
      return out;
    },
    async revoke(jti, reason) {
      const e = map.get(jti);
      if (!e) throw new Error('not found');
      const upd = { ...e, revoked: true, revokedReason: reason };
      map.set(jti, upd);
      return upd;
    },
  };
}

function mkCtx(rest: string[], format: 'json' | 'table' | 'plain' = 'table') {
  return {
    flags: { format, verbose: false, noColor: true, configDir: '.orqenix' },
    formatter: makeFormatter(format),
    scopeId: 'scp_b3_A',
    configDir: '.orqenix',
    logger: new MeshLogger({ level: 'info' }),
    metrics: new MeshMetrics(),
    license: { subject: 'scp_b3_A' as ScopeId, tier: 'pro' as const, expiresAtMs: Date.now() + 60_000, jti: 'j' },
    rest,
  };
}

describe('delegation chain show', () => {
  it('lists all delegations when no --id is given', async () => {
    const store = mkStore([mkDel({ jti: 'jti-1' }), mkDel({ jti: 'jti-2' })]);
    const cmd = makeDelegationChainShowCommand({ store });
    const r = await cmd.run(mkCtx([]));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
    const rows = r.payload as Array<{ jti: string }>;
    expect(rows.length).toBe(2);
  });

  it('walks the chain when --id is given', async () => {
    const store = mkStore([
      mkDel({ jti: 'jti-root' }),
      mkDel({ jti: 'jti-mid', parentJti: 'jti-root' }),
      mkDel({ jti: 'jti-leaf', parentJti: 'jti-mid' }),
    ]);
    const cmd = makeDelegationChainShowCommand({ store });
    const r = await cmd.run(mkCtx(['--id', 'jti-leaf']));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
    const rows = r.payload as Array<{ jti: string; depth: number }>;
    expect(rows.length).toBe(3);
    expect(rows[0].jti.startsWith('jti-leaf')).toBe(true);
  });

  it('throws NotFoundError on unknown jti', async () => {
    const store = mkStore([]);
    const cmd = makeDelegationChainShowCommand({ store });
    await expect(cmd.run(mkCtx(['--id', 'jti-missing']))).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns full chain in json mode', async () => {
    const store = mkStore([mkDel({ jti: 'jti-x' })]);
    const cmd = makeDelegationChainShowCommand({ store });
    const r = await cmd.run(mkCtx(['--id', 'jti-x'], 'json'));
    const arr = r.payload as Delegation[];
    expect(arr[0].jti).toBe('jti-x');
  });
});
