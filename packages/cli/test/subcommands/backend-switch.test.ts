import { describe, it, expect, vi } from 'vitest';
import { makeBackendSwitchCommand } from '../../src/subcommands/backend-switch.js';
import { CliError, ExitCode, UsageError } from '../../src/exit-codes.js';
import { makeFormatter } from '../../src/formatters.js';
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import type { ScopeId } from '@orqenix/mesh-transport-core';
import type { AuditEntry, AuditLog } from '../../src/subcommands/delegation-store.js';
import type { BackendInfo, BackendManager } from '../../src/subcommands/backend-manager.js';

function fakeManager(initial: BackendInfo[], probes: Record<string, boolean> = {}): BackendManager {
  const list = initial.map((b) => ({ ...b }));
  return {
    async status() { return list; },
    async readinessProbe(k) { return probes[k] ?? list.find((b) => b.kind === k)?.ready ?? false; },
    async switch(k) {
      list.forEach((b) => { b.active = b.kind === k; });
      return list.find((b) => b.kind === k)!;
    },
  };
}

function fakeAudit(): { log: AuditLog; entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    log: {
      async append(input) {
        const prevHash = entries.at(-1)?.hash ?? '0'.repeat(64);
        const entry: AuditEntry = {
          index: entries.length, ts: Date.now(),
          type: input.type, actor: input.actor, subject: input.subject, details: input.details,
          hash: `h${entries.length}`.padStart(64, '0'), prevHash,
        };
        entries.push(entry); return entry;
      },
      async get(i) { return entries[i]; },
    },
  };
}

function mkCtx(rest: string[]) {
  return {
    flags: { format: 'json' as const, verbose: false, noColor: true, configDir: '.orqenix' },
    formatter: makeFormatter('json'),
    configDir: '.orqenix',
    logger: new MeshLogger({ level: 'info' }),
    metrics: new MeshMetrics(),
    license: { subject: 'scp_b3_a' as ScopeId, tier: 'pro' as const, expiresAtMs: Date.now() + 60_000, jti: 'j' },
    rest,
  };
}

const BASE: BackendInfo[] = [
  { kind: 'sqlite',  active: true,  ready: true,  version: '3.45' },
  { kind: 'lmdb',    active: false, ready: true,  version: '0.9' },
  { kind: 'kuzu',    active: false, ready: false, version: '0.4', lastError: 'graph store unreachable' },
  { kind: 'lancedb', active: false, ready: true,  version: '0.10' },
];

describe('backend switch', () => {
  it('switches to a ready backend and writes audit type backend.switch', async () => {
    const manager = fakeManager(BASE);
    const { log, entries } = fakeAudit();
    const cmd = makeBackendSwitchCommand({ manager, audit: log });
    const r = await cmd.run(mkCtx(['lmdb']));
    expect(r.exitCode).toBe(ExitCode.SUCCESS);
    expect(entries[0].type).toBe('backend.switch');
    expect(entries[0].details.from).toBe('sqlite');
    expect(entries[0].details.to).toBe('lmdb');
  });

  it('refuses with exit 1 if target backend is not ready and does NOT write audit', async () => {
    const manager = fakeManager(BASE);
    const { log, entries } = fakeAudit();
    const spy = vi.spyOn(log, 'append');
    const cmd = makeBackendSwitchCommand({ manager, audit: log });
    await expect(cmd.run(mkCtx(['kuzu']))).rejects.toMatchObject({ code: ExitCode.GENERIC });
    expect(spy).not.toHaveBeenCalled();
    expect(entries.length).toBe(0);
  });

  it('refuses with exit 2 (USAGE) when target is already active', async () => {
    const manager = fakeManager(BASE);
    const { log } = fakeAudit();
    const cmd = makeBackendSwitchCommand({ manager, audit: log });
    await expect(cmd.run(mkCtx(['sqlite']))).rejects.toBeInstanceOf(UsageError);
  });

  it('rejects unknown backend kind with UsageError', async () => {
    const manager = fakeManager(BASE);
    const { log } = fakeAudit();
    const cmd = makeBackendSwitchCommand({ manager, audit: log });
    await expect(cmd.run(mkCtx(['mariadb']))).rejects.toBeInstanceOf(UsageError);
  });

  it('returns audit_index and audit_hash for traceability', async () => {
    const manager = fakeManager(BASE);
    const { log } = fakeAudit();
    const cmd = makeBackendSwitchCommand({ manager, audit: log });
    const r = await cmd.run(mkCtx(['lancedb']));
    const p = r.payload as { audit_index: number; audit_hash: string; from: string; to: string };
    expect(p.audit_index).toBe(0);
    expect(p.from).toBe('sqlite');
    expect(p.to).toBe('lancedb');
  });
});
