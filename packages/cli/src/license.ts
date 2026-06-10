// packages/cli/src/license.ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import { AuthError } from './exit-codes.js';

export interface ProLicenseVerifier {
  verify(rawToken: string): Promise<
    | { ok: true; license: ProLicense }
    | { ok: false; code: string; message: string }
  >;
}

export interface ProLicense {
  subject: ScopeId;
  tier: 'pro';
  expiresAtMs: number;
  jti: string;
}

const LICENSE_DOCS_URL = 'https://orqenix.dev/docs/pro/license';

export interface LoadLicenseOptions {
  configDir?: string;
  envVar?: string;
  verifier: ProLicenseVerifier;
  now?: () => number;
}

export async function loadAndVerifyLicense(opts: LoadLicenseOptions): Promise<ProLicense> {
  const now = (opts.now ?? Date.now)();
  const configDir = opts.configDir ?? '.orqenix';
  const envVar = opts.envVar ?? 'ORQENIX_PRO_LICENSE';

  const fromEnv = process.env[envVar];
  let raw: string | undefined = fromEnv?.trim();

  if (!raw) {
    try {
      const text = await readFile(join(configDir, 'license.txt'), 'utf8');
      raw = text.trim();
    } catch {
      // ignore; raw stays undefined
    }
  }

  if (!raw) {
    throw new AuthError(
      'Pro license required',
      `Set ${envVar} or place a license at ${join(configDir, 'license.txt')}. See ${LICENSE_DOCS_URL}.`,
    );
  }

  const result = await opts.verifier.verify(raw);
  if (!result.ok) {
    throw new AuthError(
      `Pro license invalid: ${result.code}`,
      `See ${LICENSE_DOCS_URL}.`,
    );
  }

  if (now >= result.license.expiresAtMs) {
    throw new AuthError(
      'Pro license expired',
      `Renew at ${LICENSE_DOCS_URL}.`,
    );
  }

  if (result.license.tier !== 'pro') {
    throw new AuthError(
      'Token does not carry pro tier entitlement',
      `See ${LICENSE_DOCS_URL}.`,
    );
  }

  return result.license;
}

export function requireProTier(license: ProLicense): void {
  if (license.tier !== 'pro') {
    throw new AuthError('This command requires the Pro tier');
  }
}
