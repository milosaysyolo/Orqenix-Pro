// SPDX-License-Identifier: BUSL-1.1
// @gate G37-pro
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import {
  BlastRadiusStore, BLAST_RADIUS_MIGRATIONS,
  QuotaExceededError, QuotaNotConfiguredError, QUOTA_KINDS,
} from '@orqenix-pro/blast-radius';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const REPORT_DIR = join(REPO_ROOT, '.orqenix-pro/gate-reports');
const A = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

interface GateCheckResult { id: string; description: string; status: 'pass' | 'fail'; durationMs: number; error?: { message: string }; }

async function check(id: string, description: string, fn: () => Promise<void> | void): Promise<GateCheckResult> {
  const start = Date.now();
  try { await fn(); return { id, description, status: 'pass', durationMs: Date.now() - start }; }
  catch (e) { return { id, description, status: 'fail', durationMs: Date.now() - start, error: { message: (e as Error).message } }; }
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'g37-pro-'));
  const conn = new SqliteConnection({ path: join(dir, 'br.sqlite') });
  runMigrations(conn, BLAST_RADIUS_MIGRATIONS);
  let now = new Date('2026-06-02T12:00:00Z').getTime();
  const store = new BlastRadiusStore({ conn, scopeId: A, now: () => new Date(now).toISOString() });
  return { dir, conn, store, advance: (ms: number) => { now += ms; } };
}

async function tear(dir: string, conn: SqliteConnection) {
  conn.close(); await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

async function runChecks(): Promise<GateCheckResult[]> {
  return [
    await check('G37-pro.1', 'blast-radius unit tests pass', () => {
      execSync('pnpm vitest run', { cwd: join(REPO_ROOT, 'packages/blast-radius'), stdio: 'pipe' });
    }),
    await check('G37-pro.2', 'setQuota + getQuota round-trip', async () => {
      const { dir, conn, store } = await setup();
      try {
        store.setQuota({ kind: 'writes_per_hour', limit: 100, windowMs: 3600_000 });
        const q = store.getQuota('writes_per_hour');
        if (q?.limit !== 100) throw new Error('round-trip failed');
      } finally { await tear(dir, conn); }
    }),
    await check('G37-pro.3', 'consume increments + QuotaExceededError on overflow', async () => {
      const { dir, conn, store } = await setup();
      try {
        store.setQuota({ kind: 'writes_per_hour', limit: 5, windowMs: 3600_000 });
        store.consume('writes_per_hour', 3);
        let caught = false;
        try { store.consume('writes_per_hour', 5); } catch (e) { caught = e instanceof QuotaExceededError; }
        if (!caught) throw new Error('overflow not detected');
      } finally { await tear(dir, conn); }
    }),
    await check('G37-pro.4', 'consume throws QuotaNotConfiguredError when no quota set', async () => {
      const { dir, conn, store } = await setup();
      try {
        let caught = false;
        try { store.consume('writes_per_hour'); } catch (e) { caught = e instanceof QuotaNotConfiguredError; }
        if (!caught) throw new Error('not-configured not detected');
      } finally { await tear(dir, conn); }
    }),
    await check('G37-pro.5', 'window rolls over with advancing clock', async () => {
      const { dir, conn, store, advance } = await setup();
      try {
        store.setQuota({ kind: 'writes_per_hour', limit: 5, windowMs: 3600_000 });
        store.consume('writes_per_hour', 5);
        let caught = false;
        try { store.consume('writes_per_hour', 1); } catch (e) { caught = e instanceof QuotaExceededError; }
        if (!caught) throw new Error('first overflow missed');
        advance(3601_000);
        const fresh = store.consume('writes_per_hour', 2);
        if (fresh.consumed !== 2) throw new Error('window did not roll over');
      } finally { await tear(dir, conn); }
    }),
    await check('G37-pro.6', 'usage reports zero before any consume', async () => {
      const { dir, conn, store } = await setup();
      try {
        store.setQuota({ kind: 'writes_per_day', limit: 1000, windowMs: 86_400_000 });
        const u = store.usage('writes_per_day');
        if (u?.consumed !== 0) throw new Error('initial consumed != 0');
      } finally { await tear(dir, conn); }
    }),
    await check('G37-pro.7', 'setQuota upserts on conflict', async () => {
      const { dir, conn, store } = await setup();
      try {
        store.setQuota({ kind: 'writes_per_hour', limit: 10, windowMs: 3600_000 });
        store.setQuota({ kind: 'writes_per_hour', limit: 50, windowMs: 3600_000 });
        if (store.getQuota('writes_per_hour')?.limit !== 50) throw new Error('upsert failed');
      } finally { await tear(dir, conn); }
    }),
    await check('G37-pro.8', 'resetWindow zeroes current bucket', async () => {
      const { dir, conn, store } = await setup();
      try {
        store.setQuota({ kind: 'writes_per_hour', limit: 10, windowMs: 3600_000 });
        store.consume('writes_per_hour', 7);
        store.resetWindow('writes_per_hour');
        if (store.usage('writes_per_hour')?.consumed !== 0) throw new Error('reset failed');
      } finally { await tear(dir, conn); }
    }),
    await check('G37-pro.9', 'QUOTA_KINDS has all 5 required kinds', () => {
      const required = ['writes_per_hour','writes_per_day','cross_scope_writes_per_hour','detach_per_day','kb_bytes_per_day'];
      for (const k of required) {
        if (!QUOTA_KINDS.includes(k as any)) throw new Error(`missing kind: ${k}`);
      }
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
  const report = { gateId: 'G37-pro', title: 'Blast Radius Containment', status, startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - start, checks, summary: { total: checks.length, passed, failed } };
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, `G37-pro-${startedAt.replace(/[:.]/g, '-')}.json`), JSON.stringify(report, null, 2));
  const line = '─'.repeat(80);
  console.log(line); console.log(`Gate G37-pro: Blast Radius Containment`); console.log(`Status: ${status.toUpperCase()}  (${passed}/${checks.length} passed, ${report.durationMs}ms)`); console.log(line);
  for (const c of checks) {
    const icon = c.status === 'pass' ? '✓' : '✗';
    console.log(`${icon} ${c.id.padEnd(11)} ${c.description.slice(0, 55).padEnd(55)} ${String(c.durationMs).padStart(6)}ms`);
    if (c.error) console.log(`    error: ${c.error.message.split('\n')[0]}`);
  }
  console.log(line);
  process.exit(status === 'pass' ? 0 : 1);
}

main().catch((e) => { console.error('G37-pro crashed:', e); process.exit(2); });
