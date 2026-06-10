import { ExitCode } from '../exit-codes.js';
import type { Command, CommandCtx, CommandResult } from '../command.js';
import { extractIntFlag, formatRtt, requirePositional, shortScope, truncateForTable } from './helpers.js';
import { validateProbeInput, type RouteProbe } from './route-probe.js';

export interface MeshRouteDeps {
  probe: RouteProbe;
}

export function makeMeshRouteCommand(deps: MeshRouteDeps): Command {
  return {
    name: 'mesh route',
    description: 'trace the path to a target scope, transport by transport, with per-hop RTT',
    async run(ctx: CommandCtx): Promise<CommandResult> {
      const target = requirePositional(ctx.rest, 0, 'target scope id');
      const deadlineMs = extractIntFlag(ctx.rest, 'deadline-ms', 5000, 100, 60_000);
      const maxHops = extractIntFlag(ctx.rest, 'max-hops', 8, 1, 16);
      validateProbeInput(target, deadlineMs, maxHops);

      const result = await deps.probe.probe(target, { deadlineMs, maxHops });

      const exitCode =
        result.finalStatus === 'ok'      ? ExitCode.SUCCESS  :
        result.finalStatus === 'denied'  ? ExitCode.AUTH     :
        result.finalStatus === 'timeout' ? ExitCode.TIMEOUT  :
                                           ExitCode.GENERIC;

      if (ctx.flags.format === 'json') {
        return { exitCode, payload: result };
      }

      const rows = result.hops.map((h) => ({
        hop: h.hop,
        transport: h.transport,
        address: ctx.flags.format === 'table' ? truncateForTable(h.address) : h.address,
        rtt: formatRtt(h.rttMs),
        status: h.status,
      }));
      return {
        exitCode,
        payload: rows,
        columns: ['hop', 'transport', 'address', 'rtt', 'status'],
        title: `mesh route target=${shortScope(target)} total=${formatRtt(result.totalRttMs)} status=${result.finalStatus}`,
      };
    },
  };
}
