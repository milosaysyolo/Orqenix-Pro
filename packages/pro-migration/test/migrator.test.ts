// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  KuzuGraphAdapter, InMemoryGraphDriver,
  type CodeSymbol, type CodeEdge,
} from '@orqenix-pro/kb-code-graph';
import {
  LanceDBEmbeddingAdapter, InMemoryVectorDriver,
  type EmbeddingRecord,
} from '@orqenix-pro/kb-embedding-lance';
import {
  TokenStore, InMemoryKvDriver, type CachedVerification,
} from '@orqenix-pro/kb-token-store';
import {
  migrateCodeGraph, migrateEmbeddings, migrateTokenStore,
  ProMigrationVerificationError,
} from '../src';

const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function mkSym(id: string): CodeSymbol {
  return { symbolId: id, scopeId: SCOPE, kind: 'function', name: id,
    filePath: `${id}.ts`, lineStart: 1, lineEnd: 10, createdAt: '2026-06-02T00:00:00Z' };
}
function mkEdge(id: string, src: string, dst: string): CodeEdge {
  return { edgeId: id, scopeId: SCOPE, sourceSymbolId: src, targetSymbolId: dst,
    kind: 'calls', metadata: {}, createdAt: '2026-06-02T00:00:00Z' };
}
function mkEmbed(id: string, scope = SCOPE): EmbeddingRecord {
  return { id, scopeId: scope, vector: new Float32Array([1, 0, 0, 0]), metadata: {},
    createdAt: '2026-06-02T00:00:00Z' };
}
function mkVerif(jti: string, expiresAt = '2099-12-31T00:00:00Z'): CachedVerification {
  return { jti, scopeId: SCOPE, audienceScopeId: SCOPE, caps: ['read:kb-docs'],
    verifiedAt: '2026-06-02T00:00:00Z', expiresAt, signatureValid: true,
    contextHash: 'h'.repeat(32) };
}

describe('migrateCodeGraph', () => {
  let target: KuzuGraphAdapter;
  beforeEach(async () => {
    target = new KuzuGraphAdapter({ dbPath: ':memory:', driver: new InMemoryGraphDriver() });
    await target.init();
  });
  afterEach(async () => { await target.close(); });

  it('migrates symbols + edges + verifies counts', async () => {
    const syms = ['s1', 's2', 's3'].map(mkSym);
    const edges = [mkEdge('e1', 's1', 's2'), mkEdge('e2', 's2', 's3')];
    const r = await migrateCodeGraph({ symbols: syms, edges, target, scopeId: SCOPE });
    expect(r.itemsMigrated).toBe(5);
    expect(r.itemsVerified).toBe(5);
  });

  it('throws verification error when target count drifts', async () => {
    const syms = [mkSym('s1'), mkSym('s2')];
    await target.addSymbol(mkSym('rogue'));
    await expect(migrateCodeGraph({ symbols: syms, edges: [], target, scopeId: SCOPE })).rejects.toThrow(ProMigrationVerificationError);
  });
});

describe('migrateEmbeddings', () => {
  let target: LanceDBEmbeddingAdapter;
  beforeEach(async () => {
    target = new LanceDBEmbeddingAdapter({ dbPath: ':memory:', dim: 4, driver: new InMemoryVectorDriver() });
    await target.init();
  });
  afterEach(async () => { await target.close(); });

  it('migrates in batches + verifies count', async () => {
    const items = Array.from({ length: 250 }, (_, i) => mkEmbed(`r${i}`));
    const r = await migrateEmbeddings({ sourceItems: items, target, scopeId: SCOPE, batchSize: 100 });
    expect(r.itemsMigrated).toBe(250);
    expect(r.itemsVerified).toBe(250);
  });

  it('ignores other-scope items in count verification', async () => {
    const items = [mkEmbed('a'), mkEmbed('b'), mkEmbed('c', 'scope:OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO')];
    const r = await migrateEmbeddings({ sourceItems: items, target, scopeId: SCOPE });
    expect(r.itemsMigrated).toBe(3);
    expect(r.itemsVerified).toBe(2);
  });
});

describe('migrateTokenStore', () => {
  let target: TokenStore;
  beforeEach(async () => {
    target = new TokenStore({ dbPath: ':memory:', driver: new InMemoryKvDriver() });
    await target.open();
  });
  afterEach(async () => { await target.close(); });

  it('migrates non-expired entries only', async () => {
    const items = [
      mkVerif('valid1'),
      mkVerif('valid2'),
      mkVerif('expired', '2020-01-01T00:00:00Z'),
    ];
    const r = await migrateTokenStore({ sourceItems: items, target });
    expect(r.itemsMigrated).toBe(2);
    expect(r.itemsVerified).toBe(2);
  });

  it('produces zero migration for empty source', async () => {
    const r = await migrateTokenStore({ sourceItems: [], target });
    expect(r.itemsMigrated).toBe(0);
    expect(r.itemsVerified).toBe(0);
  });
});
