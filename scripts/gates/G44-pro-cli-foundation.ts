// scripts/gates/G44-pro-cli-foundation.ts
import { Application, CommandRegistry, AuthStatusCommand, ExitCode } from '../../packages/cli/src/index.js';
import type { ProLicenseVerifier } from '../../packages/cli/src/license.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  const tag = ok ? 'PASS' : 'FAIL';
  if (!ok) failures++;
  console.log(`[G44-pro] ${tag}  ${name}${detail ? `  (${detail})` : ''}`);
}

const okLic: ProLicenseVerifier = {
  async verify() {
    return {
      ok: true,
      license: { subject: 'scp_b3_gate' as ScopeId, tier: 'pro', expiresAtMs: Date.now() + 60_000, jti: 'gate' },
    };
  },
};
const badLic: ProLicenseVerifier = {
  async verify() { return { ok: false, code: 'E_SIG_INVALID', message: 'bad' }; },
};

function makeApp(verifier: ProLicenseVerifier) {
  const out: string[] = [];
  const err: string[] = [];
  const registry = new CommandRegistry();
  registry.register(AuthStatusCommand);
  const app = new Application({
    registry, verifier,
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
  });
  return { app, out, err };
}

async function withEnv<T>(token: string | undefined, fn: () => Promise<T>): Promise<T> {
  const saved = process.env.ORQENIX_PRO_LICENSE;
  if (token == null) delete process.env.ORQENIX_PRO_LICENSE;
  else process.env.ORQENIX_PRO_LICENSE = token;
  try { return await fn(); }
  finally {
    if (saved == null) delete process.env.ORQENIX_PRO_LICENSE;
    else process.env.ORQENIX_PRO_LICENSE = saved;
  }
}

async function main(): Promise<void> {
  // ---- C1: authentication works; missing or invalid token yields exit code 3 ----
  {
    const { app, err } = makeApp(okLic);
    const code = await withEnv(undefined, () => app.run(['auth', 'status']));
    check('C1a missing token -> exit 3 AUTH', code === ExitCode.AUTH && err.join('').includes('Pro license'));

    const { app: app2 } = makeApp(badLic);
    const code2 = await withEnv('tok-x', () => app2.run(['auth', 'status']));
    check('C1b invalid token -> exit 3 AUTH', code2 === ExitCode.AUTH);
  }

  // ---- C2: --json / --table / --plain all produce documented output shapes ----
  {
    const results: Record<string, { code: number; text: string }> = {};
    for (const fmt of ['--json', '--plain', '--table']) {
      const { app, out } = makeApp(okLic);
      const code = await withEnv('tok-x', () => app.run([fmt, 'auth', 'status', '--no-color']));
      results[fmt] = { code, text: out.join('') };
    }
    const jsonOk = results['--json'].code === ExitCode.SUCCESS && (() => { try { JSON.parse(results['--json'].text); return true; } catch { return false; } })();
    const plainOk = results['--plain'].code === ExitCode.SUCCESS && results['--plain'].text.includes('\t');
    const tableOk = results['--table'].code === ExitCode.SUCCESS && results['--table'].text.includes('scp_b3_gate');
    check('C2a --json produces parseable JSON', jsonOk);
    check('C2b --plain produces tab-separated rows', plainOk);
    check('C2c --table produces human-readable text', tableOk);
  }

  // ---- C3: exit codes match the table for every error class ----
  {
    const { app: a0 } = makeApp(okLic);
    const c0 = await withEnv('tok-x', () => a0.run(['auth', 'status']));
    check('C3a 0 success', c0 === ExitCode.SUCCESS);

    const { app: a2 } = makeApp(okLic);
    const c2 = await withEnv('tok-x', () => a2.run(['--bogus', 'auth', 'status']));
    check('C3b 2 usage on unknown flag', c2 === ExitCode.USAGE);

    check('C3c 3 auth covered in C1', true);

    const { app: a4 } = makeApp(okLic);
    const c4 = await withEnv('tok-x', () => a4.run(['frobnicate']));
    check('C3d 4 not found on unknown command', c4 === ExitCode.NOT_FOUND);
  }

  // ---- C4: error UX is actionable; no stack frames or absolute paths in stderr ----
  {
    const { app, err } = makeApp(okLic);
    await withEnv(undefined, () => app.run(['auth', 'status']));
    const text = err.join('');
    const noStack = !/\bat\b.*\(.+\.ts:/.test(text);
    const noPath = !/(?:\/|\\)[\w./\\-]+\.ts/.test(text);
    const hasTip = text.includes('hint:');
    check('C4 sanitized actionable error UX', noStack && noPath && hasTip, hasTip ? '' : 'missing hint line');
  }

  if (failures > 0) {
    console.error(`[G44-pro] ${failures} criterion failures`);
    process.exit(1);
  }
  console.log('[G44-pro] ALL PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
