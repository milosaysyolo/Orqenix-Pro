// packages/cli/test/command.test.ts
import { describe, it, expect } from 'vitest';
import { AuthStatusCommand } from '../src/subcommands/auth-status.js';
import { ExitCode } from '../src/exit-codes.js';
import { makeFormatter } from '../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import type { ScopeId } from '@orqenix/mesh-transport-core';

describe('auth status command', () => {
  it('returns a success CommandResult with active=true', async () => {
    const result = await AuthStatusCommand.run({
      flags: { format: 'table', verbose: false, noColor: true, configDir: '.orqenix' },
      formatter: makeFormatter('table'),
      configDir: '.orqenix',
      logger: new MeshLogger({ level: 'info' }),
      metrics: new MeshMetrics(),
      license: {
        subject: 'scp_b3_test' as ScopeId,
        tier: 'pro',
        expiresAtMs: Date.now() + 60_000,
        jti: 'jti-cmd',
      },
      rest: [],
    });
    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect((result.payload as { active: boolean }).active).toBe(true);
    expect((result.payload as { scope: string }).scope).toBe('scp_b3_test');
    expect(result.columns).toContain('active');
  });

  it('formats expires_at as ISO-8601', async () => {
    const result = await AuthStatusCommand.run({
      flags: { format: 'json', verbose: false, noColor: true, configDir: '.orqenix' },
      formatter: makeFormatter('json'),
      configDir: '.orqenix',
      logger: new MeshLogger({ level: 'info' }),
      metrics: new MeshMetrics(),
      license: {
        subject: 'scp_b3_test' as ScopeId,
        tier: 'pro',
        expiresAtMs: Date.parse('2027-01-01T00:00:00Z'),
        jti: 'jti-iso',
      },
      rest: [],
    });
    expect((result.payload as { expires_at: string }).expires_at).toBe('2027-01-01T00:00:00.000Z');
  });
});
