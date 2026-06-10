// packages/cli/test/application.test.ts
import { describe, it, expect } from 'vitest';
import { Application } from '../src/application.js';
import { CommandRegistry } from '../src/registry.js';
import { AuthStatusCommand } from '../src/subcommands/auth-status.js';
import { ExitCode } from '../src/exit-codes.js';
import type { Command } from '../src/command.js';
import type { ProLicenseVerifier } from '../src/license.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

function okVerifier(): ProLicenseVerifier {
  return {
    async verify() {
      return {
        ok: true,
        license: {
          subject: 'scp_b3_a' as ScopeId,
          tier: 'pro',
          expiresAtMs: Date.now() + 60_000,
          jti: 'jti-app',
        },
      };
    },
  };
}

function denyVerifier(): ProLicenseVerifier {
  return { async verify() { return { ok: false, code: 'E_SIG', message: 'bad' }; } };
}

function makeApp(verifier = okVerifier()) {
  const out: string[] = [];
  const err: string[] = [];
  const registry = new CommandRegistry();
  registry.register(AuthStatusCommand);
  const app = new Application({
    registry,
    verifier,
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
  });
  return { app, out, err };
}

describe('Application', () => {
  it('runs `auth status --json` to exit 0 with JSON payload', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    process.env.ORQENIX_PRO_LICENSE = 'tok-x';
    try {
      const { app, out, err } = makeApp();
      const code = await app.run(['--json', 'auth', 'status']);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(err.length).toBe(0);
      const text = out.join('');
      const parsed = JSON.parse(text);
      expect(parsed.active).toBe(true);
      expect(parsed.scope).toBe('scp_b3_a');
    } finally {
      if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
      else process.env.ORQENIX_PRO_LICENSE = saved;
    }
  });

  it('exits 3 (AUTH) when the license verifier denies', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    process.env.ORQENIX_PRO_LICENSE = 'tok-x';
    try {
      const { app, err } = makeApp(denyVerifier());
      const code = await app.run(['auth', 'status']);
      expect(code).toBe(ExitCode.AUTH);
      expect(err.join('')).toMatch(/Pro license/);
    } finally {
      if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
      else process.env.ORQENIX_PRO_LICENSE = saved;
    }
  });

  it('exits 2 (USAGE) on unknown global flag', async () => {
    const { app } = makeApp();
    const code = await app.run(['--nope', 'auth', 'status']);
    expect(code).toBe(ExitCode.USAGE);
  });

  it('exits 4 (NOT_FOUND) on unknown command', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    process.env.ORQENIX_PRO_LICENSE = 'tok-x';
    try {
      const { app, err } = makeApp();
      const code = await app.run(['frobnicate']);
      expect(code).toBe(ExitCode.NOT_FOUND);
      expect(err.join('')).toMatch(/unknown command/);
    } finally {
      if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
      else process.env.ORQENIX_PRO_LICENSE = saved;
    }
  });

  it('prints help on `orqenix help` without requiring a license', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    delete process.env.ORQENIX_PRO_LICENSE;
    try {
      const { app, out } = makeApp();
      const code = await app.run(['help']);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(out.join('')).toMatch(/Usage:/);
      expect(out.join('')).toMatch(/Exit codes:/);
    } finally {
      if (saved != null) process.env.ORQENIX_PRO_LICENSE = saved;
    }
  });

  it('prints help on --help flag without requiring a license', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    delete process.env.ORQENIX_PRO_LICENSE;
    try {
      const { app, out } = makeApp();
      const code = await app.run(['--help']);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(out.join('')).toMatch(/Usage:/);
    } finally {
      if (saved != null) process.env.ORQENIX_PRO_LICENSE = saved;
    }
  });

  it('returns GENERIC exit code when a command throws an error during run', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    process.env.ORQENIX_PRO_LICENSE = 'tok-x';
    try {
      const throwingCmd: Command = {
        name: 'fail',
        description: 'always fails',
        async run() { throw new Error('unexpected boom'); },
      };
      const r = new CommandRegistry();
      r.register(throwingCmd);
      const app = new Application({
        registry: r,
        verifier: okVerifier(),
        stdout: () => {},
        stderr: () => {},
      });
      const code = await app.run(['fail']);
      expect(code).toBe(ExitCode.GENERIC);
    } finally {
      if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
      else process.env.ORQENIX_PRO_LICENSE = saved;
    }
  });

  it('never prints a stack trace or absolute path on error', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    delete process.env.ORQENIX_PRO_LICENSE;
    try {
      const { app, err } = makeApp();
      await app.run(['auth', 'status']);
      const text = err.join('');
      expect(text).not.toMatch(/\bat\b.*\(.+\.ts:/);
      expect(text).not.toMatch(/\/[\w./\\-]+\.ts/);
    } finally {
      if (saved != null) process.env.ORQENIX_PRO_LICENSE = saved;
    }
  });
});
