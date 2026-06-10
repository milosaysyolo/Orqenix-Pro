import type { ScopeId } from '@orqenix/mesh-transport-core';
import { ExitCode } from '../exit-codes.js';
import type { Command, CommandCtx, CommandResult } from '../command.js';
import { formatRtt, shortScope } from './helpers.js';
import type { QuotaStore } from './quota-store.js';

export interface QuotaShowDeps {
  store: QuotaStore;
}

export function makeQuotaShowCommand(deps: QuotaShowDeps): Command {
  return {
    name: 'quota show',
    description: 'list all configured quotas with current usage, limit, window, and breach status',
    async run(ctx: CommandCtx): Promise<CommandResult> {
      const scope = (ctx.scopeId ?? ctx.license.subject) as ScopeId;
      const all = await deps.store.listQuotas(scope);

      if (ctx.flags.format === 'json') {
        return { exitCode: ExitCode.SUCCESS, payload: all };
      }
      const rows = all.map((q) => ({
        kind: q.kind,
        current: q.current,
        limit: q.limit,
        window_remaining: formatRtt(q.windowRemainingMs),
        breached: q.breached,
      }));
      return {
        exitCode: ExitCode.SUCCESS,
        payload: rows,
        columns: ['kind', 'current', 'limit', 'window_remaining', 'breached'],
        title: `Quotas for scope=${shortScope(scope, 22)}`,
      };
    },
  };
}
