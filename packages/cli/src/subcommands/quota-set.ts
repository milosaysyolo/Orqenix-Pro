import type { ScopeId } from '@orqenix/mesh-transport-core';
import { ExitCode, UsageError } from '../exit-codes.js';
import type { Command, CommandCtx, CommandResult } from '../command.js';
import { extractIntFlag, requirePositional, shortScope } from './helpers.js';
import { isQuotaKind, QUOTA_KINDS, type QuotaStore } from './quota-store.js';
import type { AuditLog } from './delegation-store.js';

export interface QuotaSetDeps {
  store: QuotaStore;
  audit: AuditLog;
}

export function makeQuotaSetCommand(deps: QuotaSetDeps): Command {
  return {
    name: 'quota set',
    description: 'set the limit on a quota and write a tamper-evident audit entry',
    async run(ctx: CommandCtx): Promise<CommandResult> {
      const kindRaw = requirePositional(ctx.rest, 0, 'quota kind');
      if (!isQuotaKind(kindRaw)) {
        throw new UsageError(`unknown quota kind: ${kindRaw}`, `Valid: ${QUOTA_KINDS.join(', ')}`);
      }
      const limit = extractIntFlag(ctx.rest, 'limit', NaN, 1, 10_000_000);
      if (!Number.isInteger(limit) || limit <= 0) {
        throw new UsageError('--limit is required (positive integer in [1, 10000000])');
      }

      const scope = (ctx.scopeId ?? ctx.license.subject) as ScopeId;
      const updated = await deps.store.setLimit(scope, kindRaw, limit);

      const entry = await deps.audit.append({
        type: 'quota.set',
        actor: ctx.license.subject,
        subject: `${scope}:${kindRaw}`,
        details: {
          scope,
          kind: kindRaw,
          previous_limit: undefined,
          new_limit: updated.limit,
          current_usage: updated.current,
        },
      });

      const payload = {
        scope,
        kind: kindRaw,
        new_limit: updated.limit,
        current: updated.current,
        breached: updated.breached,
        audit_index: entry.index,
        audit_hash: entry.hash,
        prev_hash: entry.prevHash,
      };
      if (ctx.flags.format === 'json') return { exitCode: ExitCode.SUCCESS, payload };
      return {
        exitCode: ExitCode.SUCCESS,
        payload,
        columns: ['scope', 'kind', 'new_limit', 'current', 'breached', 'audit_index', 'audit_hash'],
        title: `quota set ${kindRaw} -> ${limit} (scope=${shortScope(scope, 22)})`,
      };
    },
  };
}
