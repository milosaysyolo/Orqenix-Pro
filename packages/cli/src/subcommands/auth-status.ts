// packages/cli/src/subcommands/auth-status.ts
import { ExitCode } from '../exit-codes.js';
import type { Command, CommandCtx, CommandResult } from '../command.js';

export const AuthStatusCommand: Command = {
  name: 'auth status',
  description: 'show the current Pro license status (subject, tier, expiry)',
  async run(ctx: CommandCtx): Promise<CommandResult> {
    const payload = {
      active: true,
      scope: ctx.license.subject,
      tier: ctx.license.tier,
      expires_at: new Date(ctx.license.expiresAtMs).toISOString(),
      jti: ctx.license.jti,
    };
    return {
      exitCode: ExitCode.SUCCESS,
      payload,
      columns: ['active', 'scope', 'tier', 'expires_at', 'jti'],
      title: 'Pro license status',
    };
  },
};
