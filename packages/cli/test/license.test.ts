// packages/cli/test/license.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthError, ExitCode } from '../src/exit-codes.js';
import { loadAndVerifyLicense, requireProTier, type ProLicenseVerifier } from '../src/license.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

function okVerifier(): ProLicenseVerifier {
  return {
    async verify(_raw) {
      return {
        ok: true,
        license: {
          subject: 'scp_b3_a' as ScopeId,
          tier: 'pro',
          expiresAtMs: Date.now() + 60_000,
          jti: 'jti-1',
        },
      };
    },
  };
}

function denyVerifier(code = 'E_SIG_INVALID'): ProLicenseVerifier {
  return {
    async verify() { return { ok: false, code, message: 'denied' }; },
  };
}

describe('license loader', () => {
  it('reads token from env when present and returns ProLicense on ok', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    process.env.ORQENIX_PRO_LICENSE = 'token-from-env';
    try {
      const lic = await loadAndVerifyLicense({ verifier: okVerifier() });
      expect(lic.tier).toBe('pro');
    } finally {
      if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
      else process.env.ORQENIX_PRO_LICENSE = saved;
    }
  });

  it('falls back to <configDir>/license.txt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orqenix-lic-'));
    const saved = process.env.ORQENIX_PRO_LICENSE;
    delete process.env.ORQENIX_PRO_LICENSE;
    try {
      await writeFile(join(dir, 'license.txt'), 'token-from-file');
      const lic = await loadAndVerifyLicense({ configDir: dir, verifier: okVerifier() });
      expect(lic.subject).toBe('scp_b3_a');
    } finally {
      if (saved != null) process.env.ORQENIX_PRO_LICENSE = saved;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('throws AuthError with exit code 3 when no token is provided', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orqenix-lic-'));
    const saved = process.env.ORQENIX_PRO_LICENSE;
    delete process.env.ORQENIX_PRO_LICENSE;
    try {
      await expect(
        loadAndVerifyLicense({ configDir: dir, verifier: okVerifier() }),
      ).rejects.toMatchObject({ code: ExitCode.AUTH });
    } finally {
      if (saved != null) process.env.ORQENIX_PRO_LICENSE = saved;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects expired tokens with AuthError', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    process.env.ORQENIX_PRO_LICENSE = 'token-x';
    try {
      const expired: ProLicenseVerifier = {
        async verify() {
          return {
            ok: true,
            license: { subject: 'a' as ScopeId, tier: 'pro', expiresAtMs: 0, jti: 'j' },
          };
        },
      };
      await expect(loadAndVerifyLicense({ verifier: expired })).rejects.toBeInstanceOf(AuthError);
    } finally {
      if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
      else process.env.ORQENIX_PRO_LICENSE = saved;
    }
  });

  it('rejects when verifier returns ok:false', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    process.env.ORQENIX_PRO_LICENSE = 'token-x';
    try {
      await expect(loadAndVerifyLicense({ verifier: denyVerifier() })).rejects.toBeInstanceOf(AuthError);
    } finally {
      if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
      else process.env.ORQENIX_PRO_LICENSE = saved;
    }
  });

  it('rejects token with non-pro tier', async () => {
    const saved = process.env.ORQENIX_PRO_LICENSE;
    process.env.ORQENIX_PRO_LICENSE = 'token-x';
    try {
      const nonPro: ProLicenseVerifier = {
        async verify() {
          return {
            ok: true,
            license: { subject: 'a' as ScopeId, tier: 'team', expiresAtMs: Date.now() + 60_000, jti: 'j' },
          };
        },
      };
      await expect(loadAndVerifyLicense({ verifier: nonPro })).rejects.toBeInstanceOf(AuthError);
    } finally {
      if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
      else process.env.ORQENIX_PRO_LICENSE = saved;
    }
  });

  it('requireProTier throws for non-pro tier', () => {
    expect(() => requireProTier({ subject: 'x' as ScopeId, tier: 'team', expiresAtMs: 0, jti: 'j' })).toThrow(AuthError);
  });

  it('requireProTier does not throw for pro tier', () => {
    expect(() => requireProTier({ subject: 'x' as ScopeId, tier: 'pro', expiresAtMs: 0, jti: 'j' })).not.toThrow();
  });
});
