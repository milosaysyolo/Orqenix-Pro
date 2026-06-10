// packages/cli/bin/route-probe-default.mjs
import { MeshRouter } from '@orqenix/mesh-routing';

export class RouterRouteProbe {
  constructor() {
    this._router = new MeshRouter();
  }

  async probe(target, opts) {
    const { deadlineMs, maxHops, signal } = opts;
    const start = Date.now();
    try {
      const result = await this._router.query({
        text: 'system.ping',
        k: 1,
        timeoutMs: deadlineMs,
        targetScopeIds: [target],
        maxHops,
        signal,
      });
      const elapsed = Date.now() - start;
      const hops = (result.hops || []).map((h, i) => ({
        hop: i + 1,
        transport: h.transport || 'http',
        address: h.address || 'unknown',
        rttMs: h.rttMs || 0,
        status: h.status || 'ok',
      }));
      return {
        target,
        hops,
        totalRttMs: elapsed,
        finalStatus: result.status === 'timeout' ? 'timeout' : result.status === 'denied' ? 'denied' : 'ok',
      };
    } catch (e) {
      const elapsed = Date.now() - start;
      return {
        target,
        hops: [],
        totalRttMs: elapsed,
        finalStatus: e.message && e.message.includes('timeout') ? 'timeout' : 'error',
      };
    }
  }
}
