// packages/cli/test/smoke.integration.test.ts
import { describe, it, expect } from 'vitest';
import { Application } from '../src/application.js';
import { CommandRegistry } from '../src/registry.js';
import { AuthStatusCommand } from '../src/subcommands/auth-status.js';
import { ExitCode } from '../src/exit-codes.js';
import type { ProLicenseVerifier } from '../src/license.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

const okLicense: ProLicenseVerifier = {
  async verify() {
    return {
      ok: true,
      license: {
        subject: 'scp_b3_smoke' as ScopeId,
        tier: 'pro',
        expiresAtMs: Date.parse('2030-01-01T00:00:00Z'),
        jti: 'jti-smoke',
      },
    };
  },
};

describe('Pro Part 11A smoke: framework round-trip', () => {
  it('table -> json -> plain all produce coherent output for the same payload', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    process.env.ORQENIX_PRO_LICENSE = 'tok-smoke';

    const outputs: Record<string, string> = {};
    const registry = new CommandRegistry();
    registry.register(AuthStatusCommand);

    for (const fmt of ['--json', '--plain', '--table']) {
      const out: string[] = [];
      const app = new Application({
        registry,
        verifier: okLicense,
        stdout: (s) => out.push(s),
        stderr: () => {},
      });
      const code = await app.run([fmt, 'auth', 'status', '--no-color']);
      expect(code).toBe(ExitCode.SUCCESS);
      outputs[fmt] = out.join('');
    }

    expect(() => JSON.parse(outputs['--json'])).not.toThrow();
    expect(outputs['--plain']).toMatch(/scp_b3_smoke/);
    expect(outputs['--plain']).toMatch(/\t/);
    expect(outputs['--table']).toMatch(/Pro license status/);
    expect(outputs['--table']).toMatch(/scp_b3_smoke/);

    if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
    else process.env.ORQENIX_PRO_LICENSE = saved;
  });
});
