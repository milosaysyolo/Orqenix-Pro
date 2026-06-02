// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import {
  BlastRadiusStore, BLAST_RADIUS_MIGRATIONS,
  QuotaExceededError, QuotaNotConfiguredError, QUOTA_KINDS,
} from '../src';

const A = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('BlastRadiusStore', () => {
  let dir: string;
  let conn: SqliteConnection;
  let store: BlastRadiusStore;
  let now = new Date('2026-06-02T12:00:00Z').getTime();

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orqenix-pro-br-'));
    conn = new SqliteConnection({ path: join(dir, 'br.sqlite') });
    runMigrations(conn, BLAST_RADIUS_MIGRATIONS);
    now = new Date('2026-06-02T12:00:00Z').getTime();
    store = new BlastRadiusStore({ conn, scopeId: A, now: () => new Date(now).toISOString() });
  });
  afterEach(async () => {
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('setQuota inserts + getQuota retrieves', () => {
    store.setQuota({ kind: 'writes_per_hour', limit: 100, windowMs: 3600_000 });
    const q = store.getQuota('writes_per_hour');
    expect(q?.limit).toBe(100);
    expect(q?.windowMs).toBe(3600_000);
  });

  it('consume increments usage', () => {
    store.setQuota({ kind: 'writes_per_hour', limit: 10, windowMs: 3600_000 });
    const u1 = store.consume('writes_per_hour', 3);
    expect(u1.consumed).toBe(3);
    const u2 = store.consume('writes_per_hour', 4);
    expect(u2.consumed).toBe(7);
  });

  it('consume throws QuotaExceededError when over limit', () => {
    store.setQuota({ kind: 'writes_per_hour', limit: 5, windowMs: 3600_000 });
    store.consume('writes_per_hour', 4);
    expect(() => store.consume('writes_per_hour', 2)).toThrow(QuotaExceededError);
  });

  it('consume throws QuotaNotConfiguredError when no quota set', () => {
    expect(() => store.consume('writes_per_hour', 1)).toThrow(QuotaNotConfiguredError);
  });

  it('window rolls over when time advances past windowMs', () => {
    store.setQuota({ kind: 'writes_per_hour', limit: 5, windowMs: 3600_000 });
    store.consume('writes_per_hour', 5);
    expect(() => store.consume('writes_per_hour', 1)).toThrow(QuotaExceededError);
    // advance clock by 1 hour + 1ms
    now += 3601_000;
    const fresh = store.consume('writes_per_hour', 3);
    expect(fresh.consumed).toBe(3);
  });

  it('usage returns null when quota not configured', () => {
    expect(store.usage('writes_per_hour')).toBeNull();
  });

  it('usage returns 0 consumed before any consume call', () => {
    store.setQuota({ kind: 'writes_per_day', limit: 1000, windowMs: 86_400_000 });
    const u = store.usage('writes_per_day');
    expect(u?.consumed).toBe(0);
    expect(u?.limit).toBe(1000);
  });

  it('listQuotas returns all configured quotas', () => {
    store.setQuota({ kind: 'writes_per_hour', limit: 10, windowMs: 3600_000 });
    store.setQuota({ kind: 'writes_per_day',  limit: 100, windowMs: 86_400_000 });
    expect(store.listQuotas().map((q) => q.kind).sort()).toEqual(['writes_per_day', 'writes_per_hour']);
  });

  it('removeQuota deletes config', () => {
    store.setQuota({ kind: 'writes_per_hour', limit: 10, windowMs: 3600_000 });
    expect(store.removeQuota('writes_per_hour')).toBe(true);
    expect(store.getQuota('writes_per_hour')).toBeNull();
  });

  it('setQuota upserts on conflict', () => {
    store.setQuota({ kind: 'writes_per_hour', limit: 10, windowMs: 3600_000 });
    store.setQuota({ kind: 'writes_per_hour', limit: 50, windowMs: 3600_000 });
    expect(store.getQuota('writes_per_hour')?.limit).toBe(50);
  });

  it('resetWindow zeroes current window', () => {
    store.setQuota({ kind: 'writes_per_hour', limit: 10, windowMs: 3600_000 });
    store.consume('writes_per_hour', 7);
    expect(store.usage('writes_per_hour')?.consumed).toBe(7);
    store.resetWindow('writes_per_hour');
    expect(store.usage('writes_per_hour')?.consumed).toBe(0);
  });

  it('QUOTA_KINDS exports all 5 kinds', () => {
    expect(QUOTA_KINDS.length).toBe(5);
    for (const k of ['writes_per_hour','writes_per_day','cross_scope_writes_per_hour','detach_per_day','kb_bytes_per_day']) {
      expect(QUOTA_KINDS).toContain(k as any);
    }
  });
});
