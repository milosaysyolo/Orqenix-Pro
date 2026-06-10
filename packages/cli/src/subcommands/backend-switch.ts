import { ExitCode, CliError, UsageError } from '../exit-codes.js';
import type { Command, CommandCtx, CommandResult } from '../command.js';
import { requirePositional } from './helpers.js';
import { isBackendKind, BACKEND_KINDS, type BackendManager } from './backend-manager.js';
import type { AuditLog } from './delegation-store.js';

export interface BackendSwitchDeps {
  manager: BackendManager;
  audit: AuditLog;
}

export function makeBackendSwitchCommand(deps: BackendSwitchDeps): Command {
  return {
    name: 'backend switch',
    description: 'switch the active polyglot backend after validating readiness',
    async run(ctx: CommandCtx): Promise<CommandResult> {
      const kindRaw = requirePositional(ctx.rest, 0, 'backend kind');
      if (!isBackendKind(kindRaw)) {
        throw new UsageError(`unknown backend kind: ${kindRaw}`, `Valid: ${BACKEND_KINDS.join(', ')}`);
      }

      const current = await deps.manager.status();
      const activeNow = current.find((b) => b.active);
      if (activeNow && activeNow.kind === kindRaw) {
        throw new UsageError(`${kindRaw} is already the active backend`);
      }

      const ready = await deps.manager.readinessProbe(kindRaw);
      if (!ready) {
        throw new CliError(`backend ${kindRaw} is not ready; refusing to switch`, ExitCode.GENERIC, 'Run `orqenix backend status` for details.');
      }

      const after = await deps.manager.switch(kindRaw);

      const entry = await deps.audit.append({
        type: 'backend.switch',
        actor: ctx.license.subject,
        subject: kindRaw,
        details: {
          from: activeNow?.kind ?? null,
          to: kindRaw,
          version: after.version ?? null,
        },
      });

      const payload = {
        switched_at: new Date().toISOString(),
        from: activeNow?.kind ?? null,
        to: kindRaw,
        ready: after.ready,
        audit_index: entry.index,
        audit_hash: entry.hash,
        prev_hash: entry.prevHash,
      };
      if (ctx.flags.format === 'json') return { exitCode: ExitCode.SUCCESS, payload };
      return {
        exitCode: ExitCode.SUCCESS,
        payload,
        columns: ['switched_at', 'from', 'to', 'ready', 'audit_index', 'audit_hash'],
        title: `backend switch ${activeNow?.kind ?? '<none>'} -> ${kindRaw}`,
      };
    },
  };
}
