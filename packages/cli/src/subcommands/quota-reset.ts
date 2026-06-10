import type { ScopeId } from '@orqenix/mesh-transport-core';
import { ExitCode, UsageError } from '../exit-codes.js';
import type { Command, CommandCtx, CommandResult } from '../command.js';
import { extractFlag, requirePositional, shortScope } from './helpers.js';
import { isQuotaKind, QUOTA_KINDS, type QuotaStore } from './quota-store.js';
import type { AuditLog } from './delegation-store.js';

export interface QuotaResetDeps {
  store: QuotaStore;
  audit: AuditLog;
}

export function makeQuotaResetCommand(deps: QuotaResetDeps): Command {
  return {
    name: 'quota reset',
    description: 'reset the usage counter for a quota in its current window',
    async run(ctx: CommandCtx): Promise<CommandResult> {
      const kindRaw = requirePositional(ctx.rest, 0, 'quota kind');
      if (!isQuotaKind(kindRaw)) {
        throw new UsageError(`unknown quota kind: ${kindRaw}`, `Valid: ${QUOTA_KINDS.join(', ')}`);
      }
      const reason = extractFlag(ctx.rest, 'reason');
      if (reason != null && (reason.length < 8 || reason.length > 240)) {
        throw new UsageError('--reason must be 8 to 240 characters when provided');
      }

      const scope = (ctx.scopeId ?? ctx.license.subject) as ScopeId;
      const updated = await deps.store.resetWindow(scope, kindRaw);

      const entry = await deps.audit.append({
        type: 'quota.reset',
        actor: ctx.license.subject,
        subject: `${scope}:${kindRaw}`,
        details: {
          scope,
          kind: kindRaw,
          reason: reason ?? null,
          new_window_started_at_ms: updated.windowStartedAtMs,
        },
      });

      const payload = {
        scope,
        kind: kindRaw,
        current: updated.current,
        window_remaining_ms: updated.windowRemainingMs,
        audit_index: entry.index,
        audit_hash: entry.hash,
        prev_hash: entry.prevHash,
      };
      if (ctx.flags.format === 'json') return { exitCode: ExitCode.SUCCESS, payload };
      return {
        exitCode: ExitCode.SUCCESS,
        payload,
        columns: ['scope', 'kind', 'current', 'window_remaining_ms', 'audit_index', 'audit_hash'],
        title: `quota reset ${kindRaw} (scope=${shortScope(scope, 22)})`,
      };
    },
  };
}
