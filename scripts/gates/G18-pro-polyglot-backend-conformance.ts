// SPDX-License-Identifier: BUSL-1.1
// @gate G18-pro
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
import {
  KuzuGraphAdapter, InMemoryGraphDriver, SymbolNotFoundError,
  type CodeSymbol, type CodeEdge,
} from '@orqenix-pro/kb-code-graph';
import {
  LanceDBEmbeddingAdapter, InMemoryVectorDriver,
  DimensionMismatchError, type EmbeddingRecord,
} from '@orqenix-pro/kb-embedding-lance';
import { TokenStore, InMemoryKvDriver, type CachedVerification } from '@orqenix-pro/kb-token-store';
import {
  migrateCodeGraph, migrateEmbeddings, migrateTokenStore,
  ProMigrationVerificationError,
} from '@orqenix-pro/pro-migration';

const REPO_ROOT = resolve(__dirname, '../..');
const REPORT_DIR = join(REPO_ROOT, '.orqenix-pro/gate-reports');
const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

interface GateCheckResult {
  id: string; description: string; status: 'pass' | 'fail';
  durationMs: number; error?: { message: string };
}

async function check(id: string, description: string, fn: () => Promise<void> | void): Promise<GateCheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { id, description, status: 'pass', durationMs: Date.now() - start };
  } catch (e) {
    return { id, description, status: 'fail', durationMs: Date.now() - start, error: { message: (e as Error).message } };
  }
}

function mkSym(id: string): CodeSymbol {
  return { symbolId: id, scopeId: SCOPE, kind: 'function', name: id,
    filePath: `${id}.ts`, lineStart: 1, lineEnd: 10, createdAt: '2026-06-02T00:00:00Z' };
}
function mkEdge(id: string, src: string, dst: string): CodeEdge {
  return { edgeId: id, scopeId: SCOPE, sourceSymbolId: src, targetSymbolId: dst,
    kind: 'calls', metadata: {}, createdAt: '2026-06-02T00:00:00Z' };
}
function mkEmbed(id: string): EmbeddingRecord {
  return { id, scopeId: SCOPE, vector: new Float32Array([1, 0, 0, 0]), metadata: {},
    createdAt: '2026-06-02T00:00:00Z' };
}
function mkVerif(jti: string): CachedVerification {
  return { jti, scopeId: SCOPE, audienceScopeId: SCOPE, caps: ['read:kb-docs'],
    verifiedAt: '2026-06-02T00:00:00Z', expiresAt: '2099-12-31T00:00:00Z',
    signatureValid: true, contextHash: 'h'.repeat(32) };
}

async function runChecks(): Promise<GateCheckResult[]> {
  return [
    await check('G18-pro.1', 'kb-code-graph unit tests pass', () => {
      execSync('pnpm vitest run', { cwd: join(REPO_ROOT, 'packages/kb-code-graph'), stdio: 'pipe' });
    }),
    await check('G18-pro.2', 'kb-embedding-lance unit tests pass', () => {
      execSync('pnpm vitest run', { cwd: join(REPO_ROOT, 'packages/kb-embedding-lance'), stdio: 'pipe' });
    }),
    await check('G18-pro.3', 'kb-token-store unit tests pass', () => {
      execSync('pnpm vitest run', { cwd: join(REPO_ROOT, 'packages/kb-token-store'), stdio: 'pipe' });
    }),
    await check('G18-pro.4', 'pro-migration unit tests pass', () => {
      execSync('pnpm vitest run', { cwd: join(REPO_ROOT, 'packages/pro-migration'), stdio: 'pipe' });
    }),
    await check('G18-pro.5', 'code-graph contract: add+get+neighbors round-trip', async () => {
      const a = new KuzuGraphAdapter({ dbPath: ':memory:', driver: new InMemoryGraphDriver() });
      await a.init();
      try {
        await a.addSymbol(mkSym('s1'));
        await a.addSymbol(mkSym('s2'));
        await a.addEdge(mkEdge('e1', 's1', 's2'));
        const got = await a.getSymbol('s1');
        if (got.name !== 's1') throw new Error('round-trip name mismatch');
        const n = await a.neighbors('s1', 1);
        if (n.symbols.length !== 1 || n.symbols[0].symbolId !== 's2') throw new Error('neighbors traversal wrong');
      } finally { await a.close(); }
    }),
    await check('G18-pro.6', 'code-graph contract: addEdge rejects missing endpoint', async () => {
      const a = new KuzuGraphAdapter({ dbPath: ':memory:', driver: new InMemoryGraphDriver() });
      await a.init();
      try {
        await a.addSymbol(mkSym('s1'));
        let caught = false;
        try { await a.addEdge(mkEdge('e1', 's1', 'missing')); } catch (e) { caught = e instanceof SymbolNotFoundError; }
        if (!caught) throw new Error('missing endpoint not detected');
      } finally { await a.close(); }
    }),
    await check('G18-pro.7', 'embedding contract: cosine ANN search returns nearest', async () => {
      const a = new LanceDBEmbeddingAdapter({ dbPath: ':memory:', dim: 4, driver: new InMemoryVectorDriver() });
      await a.init();
      try {
        await a.upsert(mkEmbed('a'));
        await a.upsert({ ...mkEmbed('b'), vector: new Float32Array([0, 1, 0, 0]) });
        const hits = await a.search(new Float32Array([1, 0, 0, 0]), { k: 1 });
        if (hits[0].id !== 'a') throw new Error('nearest neighbor wrong');
      } finally { await a.close(); }
    }),
    await check('G18-pro.8', 'embedding contract: rejects dimension mismatch', async () => {
      const a = new LanceDBEmbeddingAdapter({ dbPath: ':memory:', dim: 4, driver: new InMemoryVectorDriver() });
      await a.init();
      try {
        let caught = false;
        try { await a.upsert({ ...mkEmbed('x'), vector: new Float32Array([1, 2]) }); }
        catch (e) { caught = e instanceof DimensionMismatchError; }
        if (!caught) throw new Error('dim mismatch not caught');
      } finally { await a.close(); }
    }),
    await check('G18-pro.9', 'token-store contract: hit/miss + expiration counted', async () => {
      const s = new TokenStore({ dbPath: ':memory:', driver: new InMemoryKvDriver() });
      await s.open();
      try {
        await s.put(mkVerif('valid'));
        await s.put({ ...mkVerif('expired'), expiresAt: '2020-01-01T00:00:00Z' });
        await s.get('valid');
        await s.get('expired');
        await s.get('missing');
        const stats = await s.stats();
        if (stats.hits !== 1) throw new Error(`expected 1 hit, got ${stats.hits}`);
        if (stats.misses !== 2) throw new Error(`expected 2 misses, got ${stats.misses}`);
        if (stats.expirations < 1) throw new Error(`expected at least 1 expiration, got ${stats.expirations}`);
      } finally { await s.close(); }
    }),
    await check('G18-pro.10', 'token-store contract: invalidateScope removes per-scope entries', async () => {
      const s = new TokenStore({ dbPath: ':memory:', driver: new InMemoryKvDriver() });
      await s.open();
      try {
        const SCOPE_X = 'scope:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
        await s.put(mkVerif('a'));
        await s.put(mkVerif('b'));
        await s.put({ ...mkVerif('c'), scopeId: SCOPE_X, audienceScopeId: SCOPE_X });
        const removed = await s.invalidateScope(SCOPE);
        if (removed !== 2) throw new Error(`expected 2 removed, got ${removed}`);
        if (await s.size() !== 1) throw new Error('non-target scope mutated');
      } finally { await s.close(); }
    }),
    await check('G18-pro.11', 'pro-migration: code-graph migrate + verify', async () => {
      const target = new KuzuGraphAdapter({ dbPath: ':memory:', driver: new InMemoryGraphDriver() });
      await target.init();
      try {
        const syms = ['s1', 's2', 's3'].map(mkSym);
        const edges = [mkEdge('e1', 's1', 's2'), mkEdge('e2', 's2', 's3')];
        const r = await migrateCodeGraph({ symbols: syms, edges, target, scopeId: SCOPE });
        if (r.itemsMigrated !== 5) throw new Error('migration count wrong');
        if (r.itemsVerified !== 5) throw new Error('verification count wrong');
      } finally { await target.close(); }
    }),
    await check('G18-pro.12', 'pro-migration: detects count drift via ProMigrationVerificationError', async () => {
      const target = new LanceDBEmbeddingAdapter({ dbPath: ':memory:', dim: 4, driver: new InMemoryVectorDriver() });
      await target.init();
      try {
        await target.upsert(mkEmbed('rogue'));
        let caught = false;
        try {
          await migrateEmbeddings({ sourceItems: [mkEmbed('a'), mkEmbed('b')], target, scopeId: SCOPE });
        } catch (e) { caught = e instanceof ProMigrationVerificationError; }
        if (!caught) throw new Error('drift not detected');
      } finally { await target.close(); }
    }),
    await check('G18-pro.13', 'pro-migration: token-store migration excludes expired', async () => {
      const target = new TokenStore({ dbPath: ':memory:', driver: new InMemoryKvDriver() });
      await target.open();
      try {
        const items = [
          mkVerif('v1'), mkVerif('v2'),
          { ...mkVerif('exp'), expiresAt: '2020-01-01T00:00:00Z' },
        ];
        const r = await migrateTokenStore({ sourceItems: items, target });
        if (r.itemsMigrated !== 2) throw new Error('expired entries not excluded');
      } finally { await target.close(); }
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

  const report = {
    gateId: 'G18-pro', title: 'Polyglot Backend Conformance',
    status, startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    checks,
    summary: { total: checks.length, passed, failed },
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  const ts = startedAt.replace(/[:.]/g, '-');
  writeFileSync(join(REPORT_DIR, `G18-pro-${ts}.json`), JSON.stringify(report, null, 2));

  const line = '─'.repeat(80);
  console.log(line);
  console.log(`Gate G18-pro: Polyglot Backend Conformance`);
  console.log(`Status: ${status.toUpperCase()}  (${passed}/${checks.length} passed, ${report.durationMs}ms)`);
  console.log(line);
  for (const c of checks) {
    const icon = c.status === 'pass' ? '✓' : '✗';
    console.log(`${icon} ${c.id.padEnd(11)} ${c.description.slice(0, 55).padEnd(55)} ${String(c.durationMs).padStart(6)}ms`);
    if (c.error) console.log(`    error: ${c.error.message.split('\n')[0]}`);
  }
  console.log(line);

  process.exit(status === 'pass' ? 0 : 1);
}

main().catch((e) => { console.error('G18-pro crashed:', e); process.exit(2); });
