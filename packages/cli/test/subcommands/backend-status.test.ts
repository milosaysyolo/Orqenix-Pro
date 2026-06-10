import { describe, it, expect } from 'vitest';
import { makeBackendStatusCommand } from '../../src/subcommands/backend-status.js';
import { ExitCode } from '../../src/exit-codes.js';
import { makeFormatter } from '../../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { BackendInfo, BackendManager } from '../../src/subcommands/backend-manager.js';

function fakeManager(list: BackendInfo[]): BackendManager {
  return {
    async status() { return list; },
    async readinessProbe(k) { return list.find((b) => b.kind === k)?.ready ?? false; },
    async switch(k) {
      list.forEach((b) => { b.active = b.kind === k; });
      return list.find((b) => b.kind === k)!;
    },
  };
}

function mkCtx(format: 'json' | 'table' = 'json') {
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

describe('backend status', () => {
  it('reports all 4 backends with active and ready flags', async () => {
    const list: BackendInfo[] = [
      { kind: 'sqlite',  active: true,  ready: true,  version: '3.45.0' },
      { kind: 'lmdb',    active: false, ready: true,  version: '0.9.31' },
      { kind: 'kuzu',    active: false, ready: false, version: '0.4.0', lastError: 'cannot open graph store' },
      { kind: 'lancedb', active: false, ready: true,  version: '0.10.0' },
    ];
    const cmd = makeBackendStatusCommand({ manager: fakeManager(list) });
    const r = await cmd.run(mkCtx('json'));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
    const arr = r.payload as BackendInfo[];
    expect(arr).toHaveLength(4);
    expect(arr.find((b) => b.kind === 'sqlite')?.active).toBe(true);
  });

  it('renders table rows with truncated last_error', async () => {
    const list: BackendInfo[] = [
      { kind: 'sqlite', active: true, ready: true, lastError: 'a'.repeat(200) },
    ];
    const cmd = makeBackendStatusCommand({ manager: fakeManager(list) });
    const r = await cmd.run(mkCtx('table'));
    const rows = r.payload as Array<{ last_error: string }>;
    expect(rows[0].last_error.endsWith('...')).toBe(true);
  });
});
