import { describe, it, expect } from 'vitest';
import { makeMeshRouteCommand } from '../../src/subcommands/mesh-route.js';
import { ExitCode, TimeoutError, UsageError } from '../../src/exit-codes.js';
import { makeFormatter } from '../../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { RouteProbe, RouteProbeResult } from '../../src/subcommands/route-probe.js';

function mkCtx(rest: string[]) {
  return {
    flags: { format: 'json' as const, verbose: false, noColor: true, configDir: '.orqenix' },
    formatter: makeFormatter('json'),
    configDir: '.orqenix',
    logger: new MeshLogger({ level: 'info' }),
    metrics: new MeshMetrics(),
    license: { subject: 'scp_b3_x' as ScopeId, tier: 'pro' as const, expiresAtMs: Date.now() + 60_000, jti: 'j' },
    rest,
  };
}

function okProbe(): RouteProbe {
  return {
    async probe(target): Promise<RouteProbeResult> {
      return {
        target,
        hops: [
          { hop: 1, transport: 'libp2p', address: '/ip4/192.168.1.50/tcp/4101', rttMs: 4.2, status: 'ok' },
          { hop: 2, transport: 'libp2p', address: '/ip4/192.168.1.51/tcp/4101', rttMs: 7.1, status: 'ok' },
        ],
        totalRttMs: 11.3,
        finalStatus: 'ok',
      };
    },
  };
}

function timeoutProbe(): RouteProbe {
  return {
    async probe(target): Promise<RouteProbeResult> {
      return { target, hops: [], totalRttMs: 5000, finalStatus: 'timeout' };
    },
  };
}

function deniedProbe(): RouteProbe {
  return {
    async probe(target): Promise<RouteProbeResult> {
      return {
        target,
        hops: [{ hop: 1, transport: 'http', address: 'http://10.0.0.1', rttMs: 8, status: 'denied' }],
        totalRttMs: 8,
        finalStatus: 'denied',
      };
    },
  };
}

describe('mesh route', () => {
  it('exits 0 on ok with hop payload', async () => {
    const cmd = makeMeshRouteCommand({ probe: okProbe() });
    const r = await cmd.run(mkCtx(['scp_b3_target']));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
    expect((r.payload as RouteProbeResult).hops.length).toBe(2);
  });

  it('exits 5 (TIMEOUT) on probe timeout', async () => {
    const cmd = makeMeshRouteCommand({ probe: timeoutProbe() });
    const r = await cmd.run(mkCtx(['scp_b3_target']));
    expect(r.exitCode).toBe(ExitCode.TIMEOUT);
  });

  it('exits 3 (AUTH) on denied final status', async () => {
    const cmd = makeMeshRouteCommand({ probe: deniedProbe() });
    const r = await cmd.run(mkCtx(['scp_b3_target']));
    expect(r.exitCode).toBe(ExitCode.AUTH);
  });

  it('rejects missing target with UsageError', async () => {
    const cmd = makeMeshRouteCommand({ probe: okProbe() });
    await expect(cmd.run(mkCtx([]))).rejects.toBeInstanceOf(UsageError);
  });

  it('rejects out-of-range --deadline-ms', async () => {
    const cmd = makeMeshRouteCommand({ probe: okProbe() });
    await expect(cmd.run(mkCtx(['scp_b3_target', '--deadline-ms', '99'])))
      .rejects.toBeInstanceOf(UsageError);
  });

  it('rejects out-of-range --max-hops', async () => {
    const cmd = makeMeshRouteCommand({ probe: okProbe() });
    await expect(cmd.run(mkCtx(['scp_b3_target', '--max-hops', '99'])))
      .rejects.toBeInstanceOf(UsageError);
  });
});
