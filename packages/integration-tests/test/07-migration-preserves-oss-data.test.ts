// SPDX-License-Identifier: BUSL-1.1
// INTEROP-7: Running Pro migration tools (migrateCodeGraph / migrateEmbeddings)
// does not disturb existing OSS data (ChatStore, MemoryTierStore, AuditLog).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KuzuGraphAdapter, InMemoryGraphDriver, type CodeSymbol, type CodeEdge } from '@orqenix-pro/kb-code-graph';
import { LanceDBEmbeddingAdapter, InMemoryVectorDriver, type EmbeddingRecord } from '@orqenix-pro/kb-embedding-lance';
import { migrateCodeGraph, migrateEmbeddings } from '@orqenix-pro/pro-migration';
import { makeUnifiedKB, teardownKB, SCOPE_A, type UnifiedKB } from '../src/fixtures';

describe('INTEROP-7: Pro migration preserves OSS data', () => {
  let kb: UnifiedKB;
  beforeEach(async () => { kb = await makeUnifiedKB(SCOPE_A); });
  afterEach(async () => { await teardownKB(kb); });

  it('OSS chat + audit data untouched after Pro migrations run', async () => {
    // 1. Set up OSS state
    const session = kb.chat.createSession({ scopeId: SCOPE_A, title: 'pre-migration' });
    await kb.chat.appendEntry({ sessionId: session.sessionId, role: 'user', content: 'msg-1', metadata: {} });
    await kb.chat.appendEntry({ sessionId: session.sessionId, role: 'user', content: 'msg-2', metadata: {} });
    kb.auditStore.append({ actorScopeId: SCOPE_A, eventKind: 'scope_initialized', payload: {} });
    kb.auditStore.append({ actorScopeId: SCOPE_A, eventKind: 'kb_write', payload: { source: 'manual' } });

    const ossChatCountBefore = kb.chat.listEntries(session.sessionId).length;
    const ossAuditCountBefore = kb.auditStore.count();
    const ossAuditChainBefore = kb.auditStore.verifyChain();

    // 2. Run Pro migrations
    const graph = new KuzuGraphAdapter({ dbPath: ':memory:', driver: new InMemoryGraphDriver() });
    await graph.init();
    const sym1: CodeSymbol = { symbolId: 's1', scopeId: SCOPE_A, kind: 'function', name: 's1',
      filePath: 's1.ts', lineStart: 1, lineEnd: 5, createdAt: '2026-06-02T00:00:00Z' };
    const sym2: CodeSymbol = { ...sym1, symbolId: 's2', name: 's2' };
    const edge1: CodeEdge = { edgeId: 'e1', scopeId: SCOPE_A, sourceSymbolId: 's1', targetSymbolId: 's2',
      kind: 'calls', metadata: {}, createdAt: '2026-06-02T00:00:00Z' };
    const graphReport = await migrateCodeGraph({ symbols: [sym1, sym2], edges: [edge1], target: graph, scopeId: SCOPE_A });
    expect(graphReport.itemsVerified).toBe(3);

    const embed = new LanceDBEmbeddingAdapter({ dbPath: ':memory:', dim: 4, driver: new InMemoryVectorDriver() });
    await embed.init();
    const emb: EmbeddingRecord = { id: 'r1', scopeId: SCOPE_A, vector: new Float32Array([1, 0, 0, 0]), metadata: {}, createdAt: '2026-06-02T00:00:00Z' };
    const embedReport = await migrateEmbeddings({ sourceItems: [emb], target: embed, scopeId: SCOPE_A });
    expect(embedReport.itemsVerified).toBe(1);

    await graph.close();
    await embed.close();

    // 3. OSS state intact
    expect(kb.chat.listEntries(session.sessionId).length).toBe(ossChatCountBefore);
    expect(kb.auditStore.count()).toBe(ossAuditCountBefore);
    const ossAuditChainAfter = kb.auditStore.verifyChain();
    expect(ossAuditChainAfter.entriesChecked).toBe(ossAuditChainBefore.entriesChecked);
    expect(ossAuditChainAfter.ok).toBe(true);
  });

  it('OSS memory_tier_entries readable after Pro distillation creates memories', async () => {
    // Memory tier table populated via OSS API
    kb.memStore.insert({
      tier: 'episodic', type: 'preference', content: 'pre-existing OSS memory entry',
      sourceEntryIds: ['ce:1'], confidence: 0.9, scopeId: SCOPE_A, metadata: { source: 'oss' },
    } as any);
    const ossOnlyCount = kb.memStore.countByTier();
    expect(ossOnlyCount.episodic).toBe(1);

    // Pro adds memories (simulated by direct insert with proType metadata)
    kb.memStore.insert({
      tier: 'semantic', type: 'skill',
      content: 'pro-added code pattern memory entry',
      sourceEntryIds: ['ce:2'], confidence: 0.95, scopeId: SCOPE_A,
      metadata: { source: 'pro', proType: 'code_pattern', isProOnlyType: true },
    } as any);

    // OSS APIs still see all memories, including the Pro-added one
    const allTiers = kb.memStore.countByTier();
    expect(allTiers.episodic + allTiers.semantic).toBe(2);

    const skills = kb.memStore.listByType('skill');
    expect(skills.length).toBe(1);
    expect(skills[0].metadata.proType).toBe('code_pattern');
  });
});
