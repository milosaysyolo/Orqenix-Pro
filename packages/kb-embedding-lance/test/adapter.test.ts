// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LanceDBEmbeddingAdapter, InMemoryVectorDriver,
  DimensionMismatchError, EmbeddingNotFoundError,
  type EmbeddingRecord,
} from '../src';

const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SCOPE2 = 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function rec(id: string, vector: Float32Array, scope = SCOPE, text?: string): EmbeddingRecord {
  return { id, scopeId: scope, vector, text, metadata: {}, createdAt: '2026-06-02T00:00:00Z' };
}

describe('LanceDBEmbeddingAdapter (InMemoryVectorDriver)', () => {
  let adapter: LanceDBEmbeddingAdapter;

  beforeEach(async () => {
    adapter = new LanceDBEmbeddingAdapter({ dbPath: ':memory:', dim: 4, driver: new InMemoryVectorDriver() });
    await adapter.init();
  });
  afterEach(async () => { await adapter.close(); });

  it('upsert + get round-trip', async () => {
    await adapter.upsert(rec('a', new Float32Array([1, 0, 0, 0])));
    const got = await adapter.get('a');
    expect(Array.from(got.vector)).toEqual([1, 0, 0, 0]);
  });

  it('rejects invalid dimension at construction', () => {
    expect(() => new LanceDBEmbeddingAdapter({ dbPath: ':memory:', dim: 0 })).toThrow();
    expect(() => new LanceDBEmbeddingAdapter({ dbPath: ':memory:', dim: 5000 })).toThrow();
  });

  it('rejects dimension mismatch on upsert', async () => {
    await expect(adapter.upsert(rec('a', new Float32Array([1, 2, 3])))).rejects.toThrow(DimensionMismatchError);
  });

  it('get throws EmbeddingNotFoundError', async () => {
    await expect(adapter.get('missing')).rejects.toThrow(EmbeddingNotFoundError);
    expect(await adapter.tryGet('missing')).toBeNull();
  });

  it('cosine search returns nearest neighbor', async () => {
    await adapter.upsert(rec('a', new Float32Array([1, 0, 0, 0])));
    await adapter.upsert(rec('b', new Float32Array([0, 1, 0, 0])));
    await adapter.upsert(rec('c', new Float32Array([1, 0.1, 0, 0])));
    const hits = await adapter.search(new Float32Array([1, 0, 0, 0]), { k: 1, metric: 'cosine' });
    expect(hits[0].id).toBe('a');
  });

  it('l2 search returns nearest by distance', async () => {
    await adapter.upsert(rec('close', new Float32Array([1, 0, 0, 0])));
    await adapter.upsert(rec('far',   new Float32Array([10, 10, 10, 10])));
    const hits = await adapter.search(new Float32Array([1, 0, 0, 0]), { k: 2, metric: 'l2' });
    expect(hits[0].id).toBe('close');
    expect(hits[1].id).toBe('far');
  });

  it('respects scopeId filter', async () => {
    await adapter.upsert(rec('a', new Float32Array([1, 0, 0, 0]), SCOPE));
    await adapter.upsert(rec('b', new Float32Array([1, 0, 0, 0]), SCOPE2));
    const hits = await adapter.search(new Float32Array([1, 0, 0, 0]), { k: 5, scopeId: SCOPE });
    expect(hits.map((h) => h.id)).toEqual(['a']);
  });

  it('respects k cap', async () => {
    for (let i = 0; i < 50; i++) {
      await adapter.upsert(rec(`r${i}`, new Float32Array([i, 0, 0, 0])));
    }
    const hits = await adapter.search(new Float32Array([25, 0, 0, 0]), { k: 7 });
    expect(hits).toHaveLength(7);
  });

  it('upsert overwrites existing record', async () => {
    await adapter.upsert(rec('a', new Float32Array([1, 0, 0, 0]), SCOPE, 'first'));
    await adapter.upsert(rec('a', new Float32Array([0, 1, 0, 0]), SCOPE, 'second'));
    const got = await adapter.get('a');
    expect(got.text).toBe('second');
  });

  it('delete removes the record', async () => {
    await adapter.upsert(rec('a', new Float32Array([1, 0, 0, 0])));
    expect(await adapter.delete('a')).toBe(true);
    expect(await adapter.tryGet('a')).toBeNull();
    expect(await adapter.delete('a')).toBe(false);
  });

  it('count reports per-scope totals', async () => {
    await adapter.upsert(rec('a', new Float32Array([1, 0, 0, 0]), SCOPE));
    await adapter.upsert(rec('b', new Float32Array([1, 0, 0, 0]), SCOPE));
    await adapter.upsert(rec('c', new Float32Array([1, 0, 0, 0]), SCOPE2));
    expect(await adapter.count()).toBe(3);
    expect(await adapter.count(SCOPE)).toBe(2);
    expect(await adapter.count(SCOPE2)).toBe(1);
  });

  it('search rejects query of wrong dim', async () => {
    await expect(adapter.search(new Float32Array([1, 2]), { k: 5 })).rejects.toThrow(DimensionMismatchError);
  });
});
