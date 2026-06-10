import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Application } from '../../packages/cli/src/application.js';
import { CommandRegistry } from '../../packages/cli/src/registry.js';
import {
  AuthStatusCommand,
  MeshInspectCommand,
  makeMeshRouteCommand,
  makeDelegationChainShowCommand,
  makeDelegationRevokeCommand,
  type AuditEntry,
  type AuditLog,
  type Delegation,
  type DelegationStore,
  type RouteProbe,
} from '../../packages/cli/src/subcommands/index.js';
import { ExitCode } from '../../packages/cli/src/exit-codes.js';
import type { ProLicenseVerifier } from '../../packages/cli/src/license.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  const tag = ok ? 'PASS' : 'FAIL';
  if (!ok) failures++;
  console.log(`[G45-pro] ${tag}  ${name}${detail ? `  (${detail})` : ''}`);
}

const okLic: ProLicenseVerifier = {
  async verify() {
    return {
      ok: true,
      license: { subject: 'scp_b3_gate' as ScopeId, tier: 'pro', expiresAtMs: Date.now() + 60_000, jti: 'gj' },
    };
  },
};

function mkDel(jti: string, parentJti?: string): Delegation {
  return {
    jti, issuer: 'scp_b3_B' as ScopeId, subject: 'scp_b3_gate' as ScopeId,
    caps: ['memory.query', 'kb.recall.*'], expiresAtMs: Date.now() + 600_000,
    parentJti, revoked: false, createdAtMs: Date.now(),
  };
}

function fakeStore(seed: Delegation[]): DelegationStore {
  const map = new Map(seed.map((d) => [d.jti, d]));
  return {
    async listForScope() { return [...map.values()]; },
    async get(jti) { return map.get(jti); },
    async chain(jti) {
      const out: Delegation[] = [];
      let cur = map.get(jti);
      while (cur) { out.push(cur); cur = cur.parentJti ? map.get(cur.parentJti) : undefined; }
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

function chainedAudit(): { log: AuditLog; entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  const log: AuditLog = {
    async append(input) {
      const prevHash = entries.at(-1)?.hash ?? '0'.repeat(64);
      const hash = `h${entries.length}`.padStart(64, '0');
      const e: AuditEntry = {
        index: entries.length, ts: Date.now(),
        type: input.type, actor: input.actor, subject: input.subject, details: input.details,
        hash, prevHash,
      };
      entries.push(e);
      return e;
    },
    async get(i) { return entries[i]; },
  };
  return { log, entries };
}

function fakeProbe(): RouteProbe {
  return {
    async probe(target) {
      return {
        target,
        hops: [
          { hop: 1, transport: 'libp2p', address: '/ip4/192.168.1.50/tcp/4101', rttMs: 4.2, status: 'ok' },
          { hop: 2, transport: 'libp2p', address: '/ip4/192.168.1.51/tcp/4101', rttMs: 7.1, status: 'ok' },
        ],
        totalRttMs: 11.3, finalStatus: 'ok',
      };
    },
  };
}

function makeApp(probe: RouteProbe, store: DelegationStore, audit: AuditLog) {
  const out: string[] = [];
  const err: string[] = [];
  const registry = new CommandRegistry();
  registry.register(AuthStatusCommand);
  registry.register(MeshInspectCommand);
  registry.register(makeMeshRouteCommand({ probe }));
  registry.register(makeDelegationChainShowCommand({ store }));
  registry.register(makeDelegationRevokeCommand({ store, audit }));
  const app = new Application({
    registry, verifier: okLic,
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
  });
  return { app, out, err };
}

async function withEnv<T>(token: string | undefined, fn: () => Promise<T>): Promise<T> {
  const saved = process.env.ORQENIX_PRO_LICENSE;
  if (token == null) delete process.env.ORQENIX_PRO_LICENSE;
  else process.env.ORQENIX_PRO_LICENSE = token;
  try { return await fn(); }
  finally {
    if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
    else process.env.ORQENIX_PRO_LICENSE = saved;
  }
}

async function main(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'g45-'));

  await mkdir(join(dir, 'runtime'), { recursive: true });
  await writeFile(
    join(dir, 'runtime', 'status.json'),
    JSON.stringify({
      scopeId: 'scp_b3_gate',
      capturedAt: '2026-06-04T10:00:00.000Z',
      transports: [
        { kind: 'libp2p', addresses: ['/ip4/127.0.0.1/tcp/4101'], peers: 2 },
        { kind: 'http',   addresses: ['http://127.0.0.1:4180'],   peers: 0 },
      ],
      breaker: [
        { kind: 'libp2p', state: 'Closed' },
        { kind: 'http',   state: 'Closed' },
      ],
      rpcSummaries: [{ transport: 'libp2p', status: 'ok', count: 5 }],
      durations: [{ transport: 'libp2p', p50: 3.1, p95: 8.2, p99: 12.0, max: 15.5, count: 5 }],
      discovery: { entries: 1 },
      keyStore: { hits: 4, misses: 1, size: 3 },
    }),
  );

  const store = fakeStore([
    mkDel('jti-root'),
    mkDel('jti-mid', 'jti-root'),
    mkDel('jti-leaf', 'jti-mid'),
  ]);
  const { log: audit, entries } = chainedAudit();
  const probe = fakeProbe();

  try {
    {
      const a = makeApp(probe, store, audit);
      const code = await withEnv('tok', () => a.app.run(['--json', '--config', dir, 'mesh', 'inspect']));
      const text = a.out.join('');
      const okTransports = text.includes('"libp2p"') && text.includes('"http"');
      const okStats = text.includes('"p95"') || text.includes('durations');
      check('C1 mesh inspect transports + stats', code === ExitCode.SUCCESS && okTransports && okStats);
    }

    {
      const a = makeApp(probe, store, audit);
      const code = await withEnv('tok', () => a.app.run(['--json', '--config', dir, 'mesh', 'route', 'scp_b3_target']));
      const text = a.out.join('');
      const hasLibp2p = text.includes('"libp2p"');
      const hasRtt = text.includes('"rttMs"') || text.includes('rttMs');
      check('C2 mesh route transport + per-hop latency', code === ExitCode.SUCCESS && hasLibp2p && hasRtt);
    }

    {
      const a = makeApp(probe, store, audit);
      const code = await withEnv('tok', () => a.app.run([
        '--json', '--config', dir, 'delegation', 'chain', 'show', '--id', 'jti-leaf',
      ]));
      const arr = JSON.parse(a.out.join('')) as Delegation[];
      const okLen = arr.length === 3;
      const okOrder = arr[0].jti === 'jti-leaf' && arr[1].jti === 'jti-mid' && arr[2].jti === 'jti-root';
      check('C3 chain show walks parents in order', code === ExitCode.SUCCESS && okLen && okOrder);
    }

    {
      const a = makeApp(probe, store, audit);
      const code1 = await withEnv('tok', () => a.app.run([
        '--json', '--config', dir, 'delegation', 'revoke', 'jti-mid', '--reason', 'rotation policy applied',
      ]));
      const code2 = await withEnv('tok', () => a.app.run([
        '--json', '--config', dir, 'delegation', 'revoke', 'jti-leaf', '--reason', 'rotation policy applied',
      ]));
      const chained = entries.length === 2
        && entries[0].prevHash === '0'.repeat(64)
        && entries[1].prevHash === entries[0].hash;
      check('C4 revoke writes hash-chained audit entries', code1 === ExitCode.SUCCESS && code2 === ExitCode.SUCCESS && chained, `entries=${entries.length}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  if (failures > 0) {
    console.error(`[G45-pro] ${failures} criterion failures`);
    process.exit(1);
  }
  console.log('[G45-pro] ALL PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
