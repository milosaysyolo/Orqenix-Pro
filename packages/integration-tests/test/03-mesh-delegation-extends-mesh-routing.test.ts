// SPDX-License-Identifier: BUSL-1.1
// INTEROP-3: Pro DelegatedMeshRouter wraps OSS MeshRouter.
// Verify multi-hop delegation works via OSS link store + provenance chain.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MeshRouter, InMemoryMeshTransport, type MeshQueryHit } from '@orqenix/mesh-routing';
import { rootTag, verifyChain, type ProvenanceChain } from '@orqenix/provenance';
import { DelegatedMeshRouter, startChain, appendStep } from '@orqenix-pro/mesh-delegation';
import { makeUnifiedKB, teardownKB, SCOPE_A, SCOPE_B, SCOPE_C, TOK_AB, TOK_BC, type UnifiedKB } from '../src/fixtures';

function prov(sid: string): ProvenanceChain {
  return rootTag({ sourceScopeId: sid, producedAt: '2026-06-02T00:00:00Z', sourceKind: 'local' });
}
function hit(sid: string, text: string, score: number): MeshQueryHit {
  return { scopeId: sid, text, score, provenance: prov(sid) };
}

describe('INTEROP-3: Pro mesh-delegation extends OSS mesh-routing', () => {
  let kb: UnifiedKB;
  let transport: InMemoryMeshTransport;
  let baseRouter: MeshRouter;
  let delegated: DelegatedMeshRouter;

  beforeEach(async () => {
    kb = await makeUnifiedKB(SCOPE_A);
    transport = new InMemoryMeshTransport();
    baseRouter = new MeshRouter({ localScopeId: SCOPE_A, linkStore: kb.linkStore, transport });
    delegated = new DelegatedMeshRouter({ localScopeId: SCOPE_A, baseRouter, linkStore: kb.linkStore });
  });
  afterEach(async () => { await teardownKB(kb); });

  it('1-hop delegation: chain hits land on final delegate via OSS link', async () => {
    kb.linkStore.create({ remoteScopeId: SCOPE_B, direction: 'outbound' });
    kb.linkStore.updateStatus(SCOPE_B, 'outbound', 'active');
    transport.setHandler(SCOPE_B, async () => [hit(SCOPE_B, 'remote hit', 0.95)]);

    const chain = startChain(SCOPE_A, {
      delegateScopeId: SCOPE_B, tokenJti: TOK_AB,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);

    const r = await delegated.delegatedQuery({ text: 'q', k: 5, timeoutMs: 1000, chain });
    expect(r.chainHops).toBe(1);
    expect(r.hits.length).toBeGreaterThanOrEqual(1);
    expect(r.hits[0].scopeId).toBe(SCOPE_B);
  });

  it('provenance lineage preserved through delegation chain', async () => {
    kb.linkStore.create({ remoteScopeId: SCOPE_B, direction: 'outbound' });
    kb.linkStore.updateStatus(SCOPE_B, 'outbound', 'active');
    transport.setHandler(SCOPE_B, async () => [hit(SCOPE_B, 'hit', 0.9)]);

    const chain = startChain(SCOPE_A, {
      delegateScopeId: SCOPE_B, tokenJti: TOK_AB,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);

    const r = await delegated.delegatedQuery({ text: 'q', k: 5, timeoutMs: 1000, chain });
    // Each hit's provenance chain should have at least 2 tags now
    expect(r.hits[0].provenance.tags.length).toBeGreaterThanOrEqual(2);
    // OSS verifyChain should still pass on the augmented chain
    expect(() => verifyChain(r.hits[0].provenance)).not.toThrow();
    const tags = r.hits[0].provenance.tags;
    const lastTag = tags[tags.length - 1];
    expect(lastTag.sourceKind).toBe('mesh');
    expect(lastTag.tokenJti).toBe(TOK_AB);
  });

  it('multi-hop chain (A->B->C) validates and the final delegate receives the query', async () => {
    kb.linkStore.create({ remoteScopeId: SCOPE_C, direction: 'outbound' });
    kb.linkStore.updateStatus(SCOPE_C, 'outbound', 'active');
    transport.setHandler(SCOPE_C, async () => [hit(SCOPE_C, 'from C via B', 0.85)]);

    let chain = startChain(SCOPE_A, {
      delegateScopeId: SCOPE_B, tokenJti: TOK_AB,
      caps: ['read:kb-docs', 'query:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    chain = appendStep(chain, {
      delegateScopeId: SCOPE_C, tokenJti: TOK_BC,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:01:00Z',
    });

    expect(chain.steps.length).toBe(2);
    expect(chain.steps[1].remainingHops).toBe(2);

    const r = await delegated.delegatedQuery({ text: 'q', k: 5, timeoutMs: 1000, chain });
    expect(r.chainHops).toBe(2);
    expect(r.hits[0].scopeId).toBe(SCOPE_C);
    // Provenance now has 3+ tags: original local + 2 delegation hops
    expect(r.hits[0].provenance.tags.length).toBeGreaterThanOrEqual(3);
    expect(() => verifyChain(r.hits[0].provenance)).not.toThrow();
  });
});
