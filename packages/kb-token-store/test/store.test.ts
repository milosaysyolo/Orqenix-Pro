// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenStore, InMemoryKvDriver, TokenStoreClosedError, type CachedVerification } from '../src';

const SCOPE_A = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SCOPE_B = 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function ver(jti: string, scope = SCOPE_A, expiresAt = '2099-12-31T00:00:00Z'): CachedVerification {
  return {
    jti, scopeId: scope, audienceScopeId: scope,
    caps: ['read:kb-docs'], verifiedAt: '2026-06-02T00:00:00Z',
    expiresAt, signatureValid: true, contextHash: 'h'.repeat(32),
  };
}

describe('TokenStore (InMemoryKvDriver)', () => {
  let store: TokenStore;

  beforeEach(async () => {
    store = new TokenStore({ dbPath: ':memory:', driver: new InMemoryKvDriver() });
    await store.open();
  });
  afterEach(async () => { await store.close(); });

  it('put + get round-trip', async () => {
    await store.put(ver('jti1'));
    const got = await store.get('jti1');
    expect(got?.jti).toBe('jti1');
  });

  it('get returns null on miss', async () => {
    expect(await store.get('missing')).toBeNull();
    const s = await store.stats();
    expect(s.misses).toBe(1);
  });

  it('hits and misses are counted', async () => {
    await store.put(ver('a'));
    await store.get('a');
    await store.get('a');
    await store.get('miss');
    const s = await store.stats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.writes).toBe(1);
  });

  it('auto-expires entries past expiresAt', async () => {
    await store.put(ver('expired', SCOPE_A, '2020-01-01T00:00:00Z'));
    expect(await store.get('expired')).toBeNull();
    const s = await store.stats();
    expect(s.expirations).toBeGreaterThanOrEqual(1);
  });

  it('invalidate removes a single entry', async () => {
    await store.put(ver('a'));
    expect(await store.invalidate('a')).toBe(true);
    expect(await store.invalidate('a')).toBe(false);
    expect(await store.get('a')).toBeNull();
  });

  it('invalidateScope removes all entries for a scope', async () => {
    await store.put(ver('a', SCOPE_A));
    await store.put(ver('b', SCOPE_A));
    await store.put(ver('c', SCOPE_B));
    const removed = await store.invalidateScope(SCOPE_A);
    expect(removed).toBe(2);
    expect(await store.get('c')).not.toBeNull();
  });

  it('compact removes expired entries', async () => {
    await store.put(ver('e1', SCOPE_A, '2020-01-01T00:00:00Z'));
    await store.put(ver('e2', SCOPE_A, '2020-01-01T00:00:00Z'));
    await store.put(ver('valid', SCOPE_A));
    const removed = await store.compact();
    expect(removed).toBe(2);
    expect(await store.size()).toBe(1);
  });

  it('rejects operations on closed store', async () => {
    await store.close();
    await expect(store.get('x')).rejects.toThrow(TokenStoreClosedError);
    await expect(store.put(ver('x'))).rejects.toThrow(TokenStoreClosedError);
  });

  it('rejects invalid CachedVerification schema', async () => {
    const bad = { ...ver('x'), caps: [] } as unknown as CachedVerification;
    await expect(store.put(bad)).rejects.toThrow();
  });

  it('size reports current store size', async () => {
    expect(await store.size()).toBe(0);
    await store.put(ver('a'));
    await store.put(ver('b'));
    expect(await store.size()).toBe(2);
  });

  it('close is idempotent', async () => {
    await store.close();
    await store.close();
  });
});
