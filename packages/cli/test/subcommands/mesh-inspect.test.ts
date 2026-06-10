import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeMeshInspectCommand } from '../../src/subcommands/mesh-inspect.js';
import { FileBackedInspector, type NodeStatusSnapshot } from '../../src/subcommands/inspector.js';
import { makeFormatter } from '../../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import { ExitCode, NotFoundError } from '../../src/exit-codes.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

function mkSnapshot(): NodeStatusSnapshot {
  return {
    scopeId: 'scp_b3_test',
    capturedAt: '2026-06-04T10:00:00.000Z',
    transports: [
      { kind: 'libp2p', addresses: ['/ip4/127.0.0.1/tcp/4101'], peers: 2 },
      { kind: 'http',   addresses: ['http://127.0.0.1:4180'],   peers: 0 },
    ],
    breaker: [
      { kind: 'libp2p', state: 'Closed' },
      { kind: 'http',   state: 'Closed' },
    ],
    rpcSummaries: [
      { transport: 'libp2p', status: 'ok', count: 11 },
    ],
    durations: [
      { transport: 'libp2p', p50: 4.2, p95: 9.8, p99: 14.0, max: 22.5, count: 11 },
    ],
    discovery: { entries: 3 },
    keyStore: { hits: 10, misses: 1, size: 4 },
  };
}

function mkCtx(format: 'json' | 'table' | 'plain', configDir: string) {
  return {
    flags: { format, verbose: false, noColor: true, configDir },
    formatter: makeFormatter(format),
    configDir,
    logger: new MeshLogger({ level: 'info' }),
    metrics: new MeshMetrics(),
    license: { subject: 'scp_b3_test' as ScopeId, tier: 'pro' as const, expiresAtMs: Date.now() + 60_000, jti: 'j' },
    rest: [],
  };
}

describe('mesh inspect', () => {
  it('returns ok with row payload in table mode', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orqenix-insp-'));
    try {
      await mkdir(join(dir, 'runtime'), { recursive: true });
      await writeFile(join(dir, 'runtime', 'status.json'), JSON.stringify(mkSnapshot()));
      const cmd = makeMeshInspectCommand();
      const r = await cmd.run(mkCtx('table', dir));
      expect(r.exitCode).toBe(ExitCode.SUCCESS);
      expect(r.columns).toContain('kind');
      const rows = r.payload as Array<{ kind: string; peers: number }>;
      expect(rows.length).toBe(2);
      expect(rows[0].kind).toBe('libp2p');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns full snapshot in json mode', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orqenix-insp-'));
    try {
      await mkdir(join(dir, 'runtime'), { recursive: true });
      const snap = mkSnapshot();
      await writeFile(join(dir, 'runtime', 'status.json'), JSON.stringify(snap));
      const cmd = makeMeshInspectCommand();
      const r = await cmd.run(mkCtx('json', dir));
      expect((r.payload as NodeStatusSnapshot).scopeId).toBe(snap.scopeId);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('throws NotFoundError when no status snapshot exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orqenix-insp-'));
    try {
      const cmd = makeMeshInspectCommand();
      await expect(cmd.run(mkCtx('table', dir))).rejects.toBeInstanceOf(NotFoundError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('accepts a custom inspector factory for tests', async () => {
    const cmd = makeMeshInspectCommand({
      inspector: () => ({ async readStatus() { return mkSnapshot(); } }),
    });
    const r = await cmd.run(mkCtx('table', '/nowhere'));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
  });
});
