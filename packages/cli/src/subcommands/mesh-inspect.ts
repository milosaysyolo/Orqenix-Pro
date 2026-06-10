import { ExitCode } from '../exit-codes.js';
import type { Command, CommandCtx, CommandResult } from '../command.js';
import { formatRtt, shortScope, truncateForTable } from './helpers.js';
import { FileBackedInspector, type NodeInspector } from './inspector.js';

export interface MeshInspectDeps {
  inspector?: (configDir: string) => NodeInspector;
}

export function makeMeshInspectCommand(deps: MeshInspectDeps = {}): Command {
  const inspectorFactory = deps.inspector ?? ((cfg) => new FileBackedInspector(cfg));

  return {
    name: 'mesh inspect',
    description: 'show local transports, peers, breaker state, and recent RPC statistics',
    async run(ctx: CommandCtx): Promise<CommandResult> {
      const inspector = inspectorFactory(ctx.configDir);
      const snap = await inspector.readStatus();

      const transportRows = snap.transports.map((t) => {
        const br = snap.breaker.find((b) => b.kind === t.kind);
        const dur = snap.durations.find((d) => d.transport === t.kind);
        return {
          kind: t.kind,
          addresses: ctx.flags.format === 'table'
            ? truncateForTable(t.addresses.join(', '))
            : t.addresses.join(', '),
          peers: t.peers,
          breaker: br?.state ?? 'Closed',
          rpc_p50: dur ? formatRtt(dur.p50) : 'n/a',
          rpc_p95: dur ? formatRtt(dur.p95) : 'n/a',
          rpc_p99: dur ? formatRtt(dur.p99) : 'n/a',
          rpc_count: dur?.count ?? 0,
        };
      });

      if (ctx.flags.format === 'json') {
        return {
          exitCode: ExitCode.SUCCESS,
          payload: snap,
        };
      }

      return {
        exitCode: ExitCode.SUCCESS,
        payload: transportRows,
        columns: ['kind', 'addresses', 'peers', 'breaker', 'rpc_p50', 'rpc_p95', 'rpc_p99', 'rpc_count'],
        title: `Mesh inspect: scope=${shortScope(snap.scopeId)} captured=${snap.capturedAt}`,
      };
    },
  };
}

export const MeshInspectCommand: Command = makeMeshInspectCommand();
