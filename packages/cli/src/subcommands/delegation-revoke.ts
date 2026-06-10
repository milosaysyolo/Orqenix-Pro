import { ExitCode, NotFoundError, UsageError } from '../exit-codes.js';
import type { Command, CommandCtx, CommandResult } from '../command.js';
import { extractFlag, requirePositional, shortScope } from './helpers.js';
import type { AuditLog, DelegationStore } from './delegation-store.js';

export interface DelegationRevokeDeps {
  store: DelegationStore;
  audit: AuditLog;
}

export function makeDelegationRevokeCommand(deps: DelegationRevokeDeps): Command {
  return {
    name: 'delegation revoke',
    description: 'revoke a delegation by jti and write a tamper-evident audit entry',
    async run(ctx: CommandCtx): Promise<CommandResult> {
      const jti = requirePositional(ctx.rest, 0, 'delegation jti');
      const reason = extractFlag(ctx.rest, 'reason');
      if (typeof reason !== 'string' || reason.length < 8 || reason.length > 240) {
        throw new UsageError('--reason is required (8 to 240 characters)');
      }

      const existing = await deps.store.get(jti);
      if (!existing) {
        throw new NotFoundError(`delegation not found: ${jti}`);
      }
      if (existing.revoked) {
        return {
          exitCode: ExitCode.SUCCESS,
          payload: {
            jti,
            already_revoked: true,
            previous_reason: existing.revokedReason ?? null,
          },
          columns: ['jti', 'already_revoked', 'previous_reason'],
          title: `delegation already revoked: ${shortScope(jti, 26)}`,
        };
      }

      const revoked = await deps.store.revoke(jti, reason);

      const entry = await deps.audit.append({
        type: 'delegation.revoke',
        actor: ctx.license.subject,
        subject: jti,
        details: {
          issuer: revoked.issuer,
          subject_scope: revoked.subject,
          reason,
          caps_count: revoked.caps.length,
        },
      });

      const payload = {
        jti,
        revoked_at: new Date().toISOString(),
        audit_index: entry.index,
        audit_hash: entry.hash,
        prev_hash: entry.prevHash,
      };

      if (ctx.flags.format === 'json') {
        return { exitCode: ExitCode.SUCCESS, payload };
      }
      return {
        exitCode: ExitCode.SUCCESS,
        payload,
        columns: ['jti', 'revoked_at', 'audit_index', 'audit_hash', 'prev_hash'],
        title: `Delegation revoked: ${shortScope(jti, 26)}`,
      };
    },
  };
}
