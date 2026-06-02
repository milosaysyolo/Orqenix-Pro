// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { ScopeLinkStore, SCOPE_LINK_MIGRATIONS } from '@orqenix/scope-link';
import { MeshRouter, InMemoryMeshTransport, type MeshQueryHit } from '@orqenix/mesh-routing';
import { rootTag, type ProvenanceChain } from '@orqenix/provenance';
import { DelegatedMeshRouter, startChain, appendStep, DelegationUnauthorizedError } from '../src';

const A = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const C = 'scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const TOK_AB = 'tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
const TOK_BC = 'tok:EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';

function prov(sid: string): ProvenanceChain {
  return rootTag({ sourceScopeId: sid, producedAt: '2026-06-02T00:00:00Z', sourceKind: 'local' });
}
function hit(sid: string, text: string, score: number): MeshQueryHit { return { scopeId: sid, text, score, provenance: prov(sid) }; }

describe('DelegatedMeshRouter', () => {
  let dir: string;
  let conn: SqliteConnection;
  let linkStore: ScopeLinkStore;
  let transport: InMemoryMeshTransport;
  let baseRouter: MeshRouter;
  let router: DelegatedMeshRouter;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orqenix-pro-md-'));
    conn = new SqliteConnection({ path: join(dir, 'md.sqlite') });
    runMigrations(conn, SCOPE_LINK_MIGRATIONS);
    linkStore = new ScopeLinkStore({ conn, localScopeId: A });
    transport = new InMemoryMeshTransport();
    baseRouter = new MeshRouter({ localScopeId: A, linkStore, transport });
    router = new DelegatedMeshRouter({ localScopeId: A, baseRouter, linkStore });
  });
  afterEach(async () => {
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  function activate(remote: string) {
    linkStore.create({ remoteScopeId: remote, direction: 'outbound' });
    linkStore.updateStatus(remote, 'outbound', 'active');
  }

  it('delegatedQuery routes to the final delegate', async () => {
    activate(B);
    transport.setHandler(B, async () => [hit(B, 'result from B', 0.9)]);
    const chain = startChain(A, {
      delegateScopeId: B, tokenJti: TOK_AB,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    const r = await router.delegatedQuery({ text: 'hello', k: 5, timeoutMs: 1000, chain });
    expect(r.chainHops).toBe(1);
    expect(r.originScopeId).toBe(A);
    expect(r.hits[0].scopeId).toBe(B);
  });

  it('rejects chain that does not originate at local scope', async () => {
    activate(B);
    const chain = startChain(C, {
      delegateScopeId: B, tokenJti: TOK_AB,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    await expect(router.delegatedQuery({ text: 'x', k: 5, timeoutMs: 1000, chain }))
      .rejects.toThrow(DelegationUnauthorizedError);
  });

  it('forwardQuery resolves locally when this scope is the final delegate', async () => {
    activate(B); // A -> B link (since baseRouter uses linkStore for B)
    transport.setHandler(B, async () => [hit(B, 'local-resolve hit', 0.8)]);
    const chain = startChain(C, {
      delegateScopeId: A, tokenJti: TOK_BC,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    // Since this scope (A) is the final delegate, forwardQuery returns base router's result.
    // The local base router has no scopes activated for this target so it returns whatever upstream B reports.
    const r = await router.forwardQuery({ text: 'x', k: 5, timeoutMs: 1000, chain });
    expect(r.chainHops).toBe(1);
    expect(r.originScopeId).toBe(C);
  });

  it('forwardQuery requires nextDelegateScopeId when not final delegate', async () => {
    const chain = startChain(C, {
      delegateScopeId: B, tokenJti: TOK_AB,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    await expect(router.forwardQuery({ text: 'x', k: 5, timeoutMs: 1000, chain }))
      .rejects.toThrow(DelegationUnauthorizedError);
  });

  it('tags hits with provenance reflecting each delegation step', async () => {
    activate(B);
    transport.setHandler(B, async () => [hit(B, 'r', 1)]);
    let chain = startChain(A, {
      delegateScopeId: B, tokenJti: TOK_AB,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    const r = await router.delegatedQuery({ text: 'x', k: 5, timeoutMs: 1000, chain });
    expect(r.hits[0].provenance.tags.length).toBeGreaterThanOrEqual(2);
  });

  it('getMaxAllowedDepth returns CR v7.1 cap (8)', () => {
    expect(router.getMaxAllowedDepth()).toBe(8);
  });

  it('multi-hop chain (A -> B -> C) builds + validates', () => {
    let chain = startChain(A, {
      delegateScopeId: B, tokenJti: TOK_AB,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    chain = appendStep(chain, {
      delegateScopeId: C, tokenJti: TOK_BC,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:01:00Z',
    });
    expect(() => router.assertChainSane(chain)).not.toThrow();
    expect(chain.steps).toHaveLength(2);
    expect(chain.steps[1].remainingHops).toBe(2);
  });
});
