import { ExitCode } from '../exit-codes.js';
import type { Command, CommandCtx, CommandResult } from '../command.js';
import { truncateForTable } from './helpers.js';
import type { BackendManager } from './backend-manager.js';

export interface BackendStatusDeps {
  manager: BackendManager;
}

export function makeBackendStatusCommand(deps: BackendStatusDeps): Command {
  return {
    name: 'backend status',
    description: 'list polyglot backends with active flag, readiness, and last-error',
    async run(ctx: CommandCtx): Promise<CommandResult> {
      const list = await deps.manager.status();

      if (ctx.flags.format === 'json') {
        return { exitCode: ExitCode.SUCCESS, payload: list };
      }
      const rows = list.map((b) => ({
        kind: b.kind,
        active: b.active,
        ready: b.ready,
        version: b.version ?? '',
        last_error: ctx.flags.format === 'table'
          ? (b.lastError ? truncateForTable(b.lastError, 48) : '')
          : (b.lastError ?? ''),
      }));
      return {
        exitCode: ExitCode.SUCCESS,
        payload: rows,
        columns: ['kind', 'active', 'ready', 'version', 'last_error'],
        title: 'Polyglot backends',
      };
    },
  };
}
