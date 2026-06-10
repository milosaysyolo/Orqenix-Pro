import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Application } from '../../src/application.js';
import { CommandRegistry } from '../../src/registry.js';
import {
  AuthStatusCommand,
  MeshInspectCommand,
  makeMeshRouteCommand,
  makeDelegationChainShowCommand,
  makeDelegationRevokeCommand,
} from '../../src/subcommands/index.js';
import { ExitCode } from '../../src/exit-codes.js';
import type { ProLicenseVerifier } from '../../src/license.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { AuditEntry, AuditLog, Delegation, DelegationStore } from '../../src/subcommands/delegation-store.js';
import type { RouteProbe } from '../../src/subcommands/route-probe.js';

const okLic: ProLicenseVerifier = {
  async verify() {
    return {
      ok: true,
      license: {
        subject: 'scp_b3_smoke' as ScopeId, tier: 'pro',
        expiresAtMs: Date.parse('2030-01-01T00:00:00Z'), jti: 'smk',
      },
    };
  },
};

function mkDel(jti: string): Delegation {
  return {
    jti,
    issuer: 'scp_b3_B' as ScopeId,
    subject: 'scp_b3_smoke' as ScopeId,
    caps: ['memory.query'],
    expiresAtMs: Date.now() + 60_000,
    revoked: false,
    createdAtMs: Date.now() - 1000,
  };
}

function mkFakeStore(seed: Delegation[]): DelegationStore {
  const map = new Map(seed.map((d) => [d.jti, d]));
  return {
    async listForScope() { return [...map.values()]; },
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

function mkFakeAudit(): AuditLog {
  const entries: AuditEntry[] = [];
  return {
    async append(input) {
      const prevHash = entries.at(-1)?.hash ?? '0'.repeat(64);
      const entry: AuditEntry = {
        index: entries.length,
        ts: Date.now(),
        type: input.type,
        actor: input.actor,
        subject: input.subject,
        details: input.details,
        hash: `h${entries.length}`.padStart(64, '0'),
        prevHash,
      };
      entries.push(entry);
      return entry;
    },
    async get(i) { return entries[i]; },
  };
}

function mkFakeProbe(): RouteProbe {
  return {
    async probe(target) {
      return {
        target,
        hops: [
          { hop: 1, transport: 'libp2p', address: '/ip4/127.0.0.1/tcp/4101', rttMs: 3.4, status: 'ok' },
        ],
        totalRttMs: 3.4,
        finalStatus: 'ok',
      };
    },
  };
}

describe('Part 11B smoke: 4 subcommands through Application shell', () => {
  it('runs auth status + mesh inspect + mesh route + delegation chain show + delegation revoke', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orqenix-11b-'));
    try {
      await mkdir(join(dir, 'runtime'), { recursive: true });
      await writeFile(
        join(dir, 'runtime', 'status.json'),
        JSON.stringify({
          scopeId: 'scp_b3_smoke',
          capturedAt: '2026-06-04T10:00:00.000Z',
          transports: [{ kind: 'libp2p', addresses: ['/ip4/127.0.0.1/tcp/4101'], peers: 1 }],
          breaker: [{ kind: 'libp2p', state: 'Closed' }],
          rpcSummaries: [],
          durations: [],
          discovery: { entries: 0 },
          keyStore: { hits: 0, misses: 0, size: 1 },
        }),
      );

      const store = mkFakeStore([mkDel('jti-smk-1'), mkDel('jti-smk-2')]);
      const audit = mkFakeAudit();
      const probe = mkFakeProbe();

      const registry = new CommandRegistry();
      registry.register(AuthStatusCommand);
      registry.register(MeshInspectCommand);
      registry.register(makeMeshRouteCommand({ probe }));
      registry.register(makeDelegationChainShowCommand({ store }));
      registry.register(makeDelegationRevokeCommand({ store, audit }));

      function makeApp() {
        const out: string[] = [];
        const err: string[] = [];
        const app = new Application({
          registry, verifier: okLic,
          stdout: (s) => out.push(s),
          stderr: (s) => err.push(s),
        });
        return { app, out, err };
      }

      const saved = process.env.ORQENIX_PRO_LICENSE;
      process.env.ORQENIX_PRO_LICENSE = 'tok-smoke';
      try {
        let app = makeApp();
        let code = await app.app.run(['--json', '--config', dir, 'auth', 'status']);
        expect(code).toBe(ExitCode.SUCCESS);

        app = makeApp();
        code = await app.app.run(['--json', '--config', dir, 'mesh', 'inspect']);
        expect(code).toBe(ExitCode.SUCCESS);
        expect(app.out.join('')).toMatch(/scp_b3_smoke/);

        app = makeApp();
        code = await app.app.run(['--json', '--config', dir, 'mesh', 'route', 'scp_b3_target']);
        expect(code).toBe(ExitCode.SUCCESS);
        expect(app.out.join('')).toMatch(/libp2p/);

        app = makeApp();
        code = await app.app.run(['--json', '--config', dir, 'delegation', 'chain', 'show']);
        expect(code).toBe(ExitCode.SUCCESS);

        app = makeApp();
        code = await app.app.run([
          '--json', '--config', dir,
          'delegation', 'revoke', 'jti-smk-1', '--reason', 'rotation policy applied',
        ]);
        expect(code).toBe(ExitCode.SUCCESS);
        expect(app.out.join('')).toMatch(/audit_index/);
      } finally {
        if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
        else process.env.ORQENIX_PRO_LICENSE = saved;
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
