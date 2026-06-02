// SPDX-License-Identifier: BUSL-1.1
// @gate G36-pro
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { ScopeLinkStore, SCOPE_LINK_MIGRATIONS } from '@orqenix/scope-link';
import { MeshRouter, InMemoryMeshTransport } from '@orqenix/mesh-routing';
import {
  startChain, appendStep, validate, DelegatedMeshRouter,
  DelegationDepthExceededError, CapabilityNarrowingViolation, DelegationChainBrokenError,
} from '@orqenix-pro/mesh-delegation';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const REPORT_DIR = join(REPO_ROOT, '.orqenix-pro/gate-reports');
const A = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const C = 'scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const D = 'scope:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
const TOK_AB = 'tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
const TOK_BC = 'tok:EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';
const TOK_CD = 'tok:FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';

interface GateCheckResult { id: string; description: string; status: 'pass' | 'fail'; durationMs: number; error?: { message: string }; }

async function check(id: string, description: string, fn: () => Promise<void> | void): Promise<GateCheckResult> {
  const start = Date.now();
  try { await fn(); return { id, description, status: 'pass', durationMs: Date.now() - start }; }
  catch (e) { return { id, description, status: 'fail', durationMs: Date.now() - start, error: { message: (e as Error).message } }; }
}

async function runChecks(): Promise<GateCheckResult[]> {
  return [
    await check('G36-pro.1', 'mesh-delegation unit tests pass', () => {
      execSync('pnpm vitest run', { cwd: join(REPO_ROOT, 'packages/mesh-delegation'), stdio: 'pipe' });
    }),
    await check('G36-pro.2', 'startChain produces a valid 1-step chain', () => {
      const c = startChain(A, { delegateScopeId: B, tokenJti: TOK_AB, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z' }, 3);
      validate(c);
      if (c.steps.length !== 1) throw new Error('not 1 step');
      if (c.steps[0].remainingHops !== 3) throw new Error('remainingHops wrong');
    }),
    await check('G36-pro.3', '3-hop chain builds + validates', () => {
      let c = startChain(A, { delegateScopeId: B, tokenJti: TOK_AB, caps: ['read:kb-docs', 'query:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z' }, 3);
      c = appendStep(c, { delegateScopeId: C, tokenJti: TOK_BC, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:01:00Z' });
      c = appendStep(c, { delegateScopeId: D, tokenJti: TOK_CD, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:02:00Z' });
      validate(c);
      if (c.steps.length !== 3) throw new Error('not 3 steps');
    }),
    await check('G36-pro.4', 'appendStep rejects widening caps (CapabilityNarrowingViolation)', () => {
      const c = startChain(A, { delegateScopeId: B, tokenJti: TOK_AB, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z' }, 3);
      let caught = false;
      try {
        appendStep(c, { delegateScopeId: C, tokenJti: TOK_BC, caps: ['read:kb-docs', 'write:kb-docs'], delegatedAt: '2026-06-02T00:01:00Z' });
      } catch (e) { caught = e instanceof CapabilityNarrowingViolation; }
      if (!caught) throw new Error('widening not rejected');
    }),
    await check('G36-pro.5', 'appendStep rejects exceeding maxDepth (DelegationDepthExceededError)', () => {
      const c = startChain(A, { delegateScopeId: B, tokenJti: TOK_AB, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z' }, 1);
      let caught = false;
      try {
        appendStep(c, { delegateScopeId: C, tokenJti: TOK_BC, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:01:00Z' });
      } catch (e) { caught = e instanceof DelegationDepthExceededError; }
      if (!caught) throw new Error('over-cap not rejected');
    }),
    await check('G36-pro.6', 'validate catches mismatched delegator-delegate linkage', () => {
      const c = startChain(A, { delegateScopeId: B, tokenJti: TOK_AB, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z' }, 3);
      const broken = {
        ...c,
        steps: [
          c.steps[0],
          { delegatorScopeId: D, delegateScopeId: C, tokenJti: TOK_BC, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:01:00Z', remainingHops: 2 },
        ],
      };
      let caught = false;
      try { validate(broken as any); } catch (e) { caught = e instanceof DelegationChainBrokenError; }
      if (!caught) throw new Error('mismatched linkage not detected');
    }),
    await check('G36-pro.7', 'delegatedQuery routes to final delegate end-to-end', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'g36-pro-'));
      const conn = new SqliteConnection({ path: join(dir, 'g.sqlite') });
      try {
        const { SCOPE_LINK_MIGRATIONS, ScopeLinkStore } = await import('@orqenix/scope-link');
        runMigrations(conn, SCOPE_LINK_MIGRATIONS);
        const linkStore = new ScopeLinkStore({ conn, localScopeId: A });
        linkStore.create({ remoteScopeId: B, direction: 'outbound' });
        linkStore.updateStatus(B, 'outbound', 'active');
        const transport = new InMemoryMeshTransport();
        const { rootTag } = await import('@orqenix/provenance');
        transport.setHandler(B, async () => [{ scopeId: B, text: 'from B', score: 0.9,
          provenance: rootTag({ sourceScopeId: B, producedAt: '2026-06-02T00:00:00Z', sourceKind: 'local' }) }]);
        const base = new MeshRouter({ localScopeId: A, linkStore, transport });
        const dr = new DelegatedMeshRouter({ localScopeId: A, baseRouter: base, linkStore });
        const chain = startChain(A, { delegateScopeId: B, tokenJti: TOK_AB, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z' }, 3);
        const r = await dr.delegatedQuery({ text: 'x', k: 5, timeoutMs: 1000, chain });
        if (r.chainHops !== 1) throw new Error(`expected 1 hop, got ${r.chainHops}`);
        if (r.originScopeId !== A) throw new Error('origin mismatch');
      } finally { conn.close(); await new Promise((r) => setTimeout(r, 50)); await rm(dir, { recursive: true, force: true, maxRetries: 3 }); }
    }),
    await check('G36-pro.8', 'maxAllowedDepth = 8 per CR v7.1', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'g36-pro-d-'));
      const conn = new SqliteConnection({ path: join(dir, 'g.sqlite') });
      try {
        const { SCOPE_LINK_MIGRATIONS, ScopeLinkStore } = await import('@orqenix/scope-link');
        runMigrations(conn, SCOPE_LINK_MIGRATIONS);
        const linkStore = new ScopeLinkStore({ conn, localScopeId: A });
        const base = new MeshRouter({ localScopeId: A, linkStore, transport: new InMemoryMeshTransport() });
        const dr = new DelegatedMeshRouter({ localScopeId: A, baseRouter: base, linkStore });
        if (dr.getMaxAllowedDepth() !== 8) throw new Error('max depth not 8');
      } finally { conn.close(); await new Promise((r) => setTimeout(r, 50)); await rm(dir, { recursive: true, force: true, maxRetries: 3 }); }
    }),
  ];
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const checks = await runChecks();
  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : (passed === 0 ? 'fail' : 'partial');
  const report = { gateId: 'G36-pro', title: 'Mesh Delegation Chain', status, startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - start, checks, summary: { total: checks.length, passed, failed } };
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, `G36-pro-${startedAt.replace(/[:.]/g, '-')}.json`), JSON.stringify(report, null, 2));
  const line = '─'.repeat(80);
  console.log(line); console.log(`Gate G36-pro: Mesh Delegation Chain`); console.log(`Status: ${status.toUpperCase()}  (${passed}/${checks.length} passed, ${report.durationMs}ms)`); console.log(line);
  for (const c of checks) {
    const icon = c.status === 'pass' ? '✓' : '✗';
    console.log(`${icon} ${c.id.padEnd(11)} ${c.description.slice(0, 55).padEnd(55)} ${String(c.durationMs).padStart(6)}ms`);
    if (c.error) console.log(`    error: ${c.error.message.split('\n')[0]}`);
  }
  console.log(line);
  process.exit(status === 'pass' ? 0 : 1);
}

main().catch((e) => { console.error('G36-pro crashed:', e); process.exit(2); });
