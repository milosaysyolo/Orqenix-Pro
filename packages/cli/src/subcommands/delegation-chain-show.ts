import type { ScopeId } from '@orqenix/mesh-transport-core';
import { ExitCode, NotFoundError } from '../exit-codes.js';
import type { Command, CommandCtx, CommandResult } from '../command.js';
import { extractFlag, shortScope, truncateForTable } from './helpers.js';
import type { Delegation, DelegationStore } from './delegation-store.js';

export interface DelegationChainShowDeps {
  store: DelegationStore;
}

export function makeDelegationChainShowCommand(deps: DelegationChainShowDeps): Command {
  return {
    name: 'delegation chain show',
    description: 'visualize a multi-hop delegation chain or list all chains for the current scope',
    async run(ctx: CommandCtx): Promise<CommandResult> {
      const jti = extractFlag(ctx.rest, 'id');
      const scope = (ctx.scopeId ?? ctx.license.subject) as ScopeId;

      if (jti) {
        const chain = await deps.store.chain(jti);
        if (chain.length === 0) {
          throw new NotFoundError(`delegation not found: ${jti}`);
        }
        if (ctx.flags.format === 'json') {
          return { exitCode: ExitCode.SUCCESS, payload: chain };
        }
        const rows = chain.map((d, i) => ({
          depth: i,
          jti: shortScope(d.jti, 26),
          issuer: shortScope(d.issuer, 22),
          subject: shortScope(d.subject, 22),
          caps: ctx.flags.format === 'table' ? truncateForTable(d.caps.join(','), 40) : d.caps.join(','),
          expires_at: new Date(d.expiresAtMs).toISOString(),
          revoked: d.revoked,
        }));
        return {
          exitCode: ExitCode.SUCCESS,
          payload: rows,
          columns: ['depth', 'jti', 'issuer', 'subject', 'caps', 'expires_at', 'revoked'],
          title: `Delegation chain ending at jti=${shortScope(jti, 26)} (length=${chain.length})`,
        };
      }

      const all: Delegation[] = await deps.store.listForScope(scope, { includeRevoked: true });
      if (ctx.flags.format === 'json') {
        return { exitCode: ExitCode.SUCCESS, payload: all };
      }
      const rows = all.map((d) => ({
        jti: shortScope(d.jti, 26),
        issuer: shortScope(d.issuer, 22),
        subject: shortScope(d.subject, 22),
        depth: d.parentJti ? '>=1' : '0',
        expires_at: new Date(d.expiresAtMs).toISOString(),
        revoked: d.revoked,
      }));
      return {
        exitCode: ExitCode.SUCCESS,
        payload: rows,
        columns: ['jti', 'issuer', 'subject', 'depth', 'expires_at', 'revoked'],
        title: `Delegations for scope=${shortScope(scope, 22)} (count=${all.length})`,
      };
    },
  };
}
