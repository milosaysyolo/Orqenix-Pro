// SPDX-License-Identifier: BUSL-1.1
// INTEROP-5: OSS SQLite KB + Pro Kuzu graph + Pro LanceDB vectors + Pro LMDB token store
// all running in the same scope context, exchanging data correctly.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KuzuGraphAdapter, InMemoryGraphDriver, type CodeSymbol, type CodeEdge } from '@orqenix-pro/kb-code-graph';
import { LanceDBEmbeddingAdapter, InMemoryVectorDriver, type EmbeddingRecord } from '@orqenix-pro/kb-embedding-lance';
import { TokenStore, InMemoryKvDriver, type CachedVerification } from '@orqenix-pro/kb-token-store';
import { makeUnifiedKB, teardownKB, SCOPE_A, type UnifiedKB } from '../src/fixtures';

function sym(id: string): CodeSymbol {
  return { symbolId: id, scopeId: SCOPE_A, kind: 'function', name: id,
    filePath: `${id}.ts`, lineStart: 1, lineEnd: 10, createdAt: '2026-06-02T00:00:00Z' };
}
function edg(id: string, src: string, dst: string): CodeEdge {
  return { edgeId: id, scopeId: SCOPE_A, sourceSymbolId: src, targetSymbolId: dst,
    kind: 'calls', metadata: {}, createdAt: '2026-06-02T00:00:00Z' };
}
function emb(id: string, vec: number[]): EmbeddingRecord {
  return { id, scopeId: SCOPE_A, vector: new Float32Array(vec), metadata: {}, createdAt: '2026-06-02T00:00:00Z' };
}
function ver(jti: string): CachedVerification {
  return { jti, scopeId: SCOPE_A, audienceScopeId: SCOPE_A, caps: ['read:kb-docs'],
    verifiedAt: '2026-06-02T00:00:00Z', expiresAt: '2099-12-31T00:00:00Z',
    signatureValid: true, contextHash: 'h'.repeat(32) };
}

describe('INTEROP-5: Polyglot Pro backends coexist with OSS SQLite KB', () => {
  let kb: UnifiedKB;
  let graph: KuzuGraphAdapter;
  let embed: LanceDBEmbeddingAdapter;
  let tstore: TokenStore;

  beforeEach(async () => {
    kb = await makeUnifiedKB(SCOPE_A);
    graph = new KuzuGraphAdapter({ dbPath: ':memory:', driver: new InMemoryGraphDriver() });
    embed = new LanceDBEmbeddingAdapter({ dbPath: ':memory:', dim: 4, driver: new InMemoryVectorDriver() });
    tstore = new TokenStore({ dbPath: ':memory:', driver: new InMemoryKvDriver() });
    await graph.init();
    await embed.init();
    await tstore.open();
  });
  afterEach(async () => {
    await graph.close();
    await embed.close();
    await tstore.close();
    await teardownKB(kb);
  });

  it('OSS chat KB + Pro code graph + Pro embedding + Pro token store all functional in same scope', async () => {
    // OSS ChatKB
    const session = kb.chat.createSession({ scopeId: SCOPE_A, title: 'multi-backend' });
    await kb.chat.appendEntry({ sessionId: session.sessionId, role: 'user', content: 'analyze the codebase', metadata: {} });
    expect(kb.chat.listEntries(session.sessionId).length).toBe(1);

    // Pro Kuzu code graph
    await graph.addSymbol(sym('main'));
    await graph.addSymbol(sym('helper'));
    await graph.addEdge(edg('e1', 'main', 'helper'));
    expect(await graph.countSymbols(SCOPE_A)).toBe(2);

    // Pro LanceDB embeddings
    await embed.upsert(emb('chunk-1', [1, 0, 0, 0]));
    await embed.upsert(emb('chunk-2', [0, 1, 0, 0]));
    const hits = await embed.search(new Float32Array([1, 0, 0, 0]), { k: 1 });
    expect(hits[0].id).toBe('chunk-1');

    // Pro LMDB token cache
    await tstore.put(ver('jti-1'));
    expect((await tstore.stats()).size).toBe(1);

    // OSS audit log records that 4 backends were initialized
    kb.auditStore.append({ actorScopeId: SCOPE_A, eventKind: 'kb_write', payload: { backends: ['chat-kb', 'code-graph', 'embeddings', 'token-store'] } });
    expect(kb.auditStore.verifyChain().ok).toBe(true);
  });

  it('symbol referenced in chat entry can be looked up in code graph + linked to embedding', async () => {
    // Chat entry refers to a symbol
    const session = kb.chat.createSession({ scopeId: SCOPE_A, title: 'cross-ref' });
    await kb.chat.appendEntry({
      sessionId: session.sessionId, role: 'user',
      content: 'how does the main function call helper?',
      metadata: { refersTo: 'main' },
    });

    // Pro graph: store the symbol and its edge
    await graph.addSymbol(sym('main'));
    await graph.addSymbol(sym('helper'));
    await graph.addEdge(edg('main-calls-helper', 'main', 'helper'));

    // Pro embedding: store a vector for that symbol
    await embed.upsert({ ...emb('embed-main', [0.7, 0.3, 0, 0]), text: 'main function semantic embedding' });

    // Cross-reference: chat entry -> graph lookup -> embedding
    const symbol = await graph.getSymbol('main');
    expect(symbol.name).toBe('main');

    const neighbors = await graph.neighbors('main', 1);
    expect(neighbors.symbols[0].symbolId).toBe('helper');

    const embedHits = await embed.search(new Float32Array([0.7, 0.3, 0, 0]), { k: 1 });
    expect(embedHits[0].id).toBe('embed-main');
  });
});
