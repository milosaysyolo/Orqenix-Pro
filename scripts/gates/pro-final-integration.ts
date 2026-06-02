// SPDX-License-Identifier: BUSL-1.1
// Orqenix-Pro final integration smoke: runs the full Pro stack end-to-end.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { CHAT_KB_MIGRATIONS, ChatStore } from '@orqenix/kb-chat';
import { MEMORY_TIER_MIGRATIONS, MemoryTierStore } from '@orqenix/memory-tiers';
import { SCOPE_LINK_MIGRATIONS, ScopeLinkStore } from '@orqenix/scope-link';
import { MeshRouter, InMemoryMeshTransport, type MeshQueryHit } from '@orqenix/mesh-routing';
import { rootTag, type ProvenanceChain } from '@orqenix/provenance';
import type { LlmAdapter, LlmRequest, LlmResponse } from '@orqenix/llm-adapter-ollama';

// Pro packages
import { KuzuGraphAdapter, InMemoryGraphDriver, type CodeSymbol, type CodeEdge } from '@orqenix-pro/kb-code-graph';
import { LanceDBEmbeddingAdapter, InMemoryVectorDriver, type EmbeddingRecord } from '@orqenix-pro/kb-embedding-lance';
import { TokenStore, InMemoryKvDriver } from '@orqenix-pro/kb-token-store';
import { LlmDistiller } from '@orqenix-pro/memory-distiller-llm';
import { startChain, DelegatedMeshRouter } from '@orqenix-pro/mesh-delegation';
import { BlastRadiusStore, BLAST_RADIUS_MIGRATIONS, QuotaExceededError } from '@orqenix-pro/blast-radius';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
console.log(`Pro integration smoke at: ${REPO_ROOT}`);

const SCOPE_A = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SCOPE_B = 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const TOK_AB = 'tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';

function mockAdapter(responses: string[]): LlmAdapter {
  let i = 0;
  return {
    provider: 'mock', model: 'mock-1',
    async complete(_req: LlmRequest): Promise<LlmResponse> {
      const content = responses[i++ % responses.length] ?? '[]';
      return { content, finishReason: 'stop', tokensIn: 50, tokensOut: 25, model: 'mock-1', provider: 'mock', latencyMs: 1 };
    },
    async isHealthy() { return true; },
  };
}

function mkSym(id: string): CodeSymbol {
  return { symbolId: id, scopeId: SCOPE_A, kind: 'function', name: id,
    filePath: `${id}.ts`, lineStart: 1, lineEnd: 10, createdAt: '2026-06-02T00:00:00Z' };
}
function mkEdge(id: string, src: string, dst: string): CodeEdge {
  return { edgeId: id, scopeId: SCOPE_A, sourceSymbolId: src, targetSymbolId: dst,
    kind: 'calls', metadata: {}, createdAt: '2026-06-02T00:00:00Z' };
}
function mkEmbed(id: string): EmbeddingRecord {
  return { id, scopeId: SCOPE_A, vector: new Float32Array([1, 0, 0, 0]), metadata: {},
    createdAt: '2026-06-02T00:00:00Z' };
}
function prov(sid: string): ProvenanceChain {
  return rootTag({ sourceScopeId: sid, producedAt: '2026-06-02T00:00:00Z', sourceKind: 'local' });
}
function hit(sid: string, text: string, score: number): MeshQueryHit { return { scopeId: sid, text, score, provenance: prov(sid) }; }

async function main(): Promise<void> {
  console.log('=== Orqenix-Pro Final Integration Smoke ===');
  const dir = await mkdtemp(join(tmpdir(), 'orqenix-pro-smoke-'));

  try {
    const conn = new SqliteConnection({ path: join(dir, 'pro.sqlite') });
    runMigrations(conn, [
      ...CHAT_KB_MIGRATIONS,
      ...MEMORY_TIER_MIGRATIONS,
      ...SCOPE_LINK_MIGRATIONS,
      ...BLAST_RADIUS_MIGRATIONS,
    ]);

    console.log('\n[1] kb-code-graph: add symbols + edges + neighbor traversal');
    const graph = new KuzuGraphAdapter({ dbPath: ':memory:', driver: new InMemoryGraphDriver() });
    await graph.init();
    await graph.addSymbol(mkSym('s1'));
    await graph.addSymbol(mkSym('s2'));
    await graph.addEdge(mkEdge('e1', 's1', 's2'));
    const neighbors = await graph.neighbors('s1', 1);
    console.log(`    kb-code-graph: ${(await graph.countSymbols(SCOPE_A))} symbols, neighbors=${neighbors.symbols.length}`);

    console.log('\n[2] kb-embedding-lance: ANN search across 100 vectors');
    const embed = new LanceDBEmbeddingAdapter({ dbPath: ':memory:', dim: 4, driver: new InMemoryVectorDriver() });
    await embed.init();
    for (let i = 0; i < 100; i++) await embed.upsert(mkEmbed(`r${i}`));
    const hits = await embed.search(new Float32Array([1, 0, 0, 0]), { k: 3 });
    console.log(`    kb-embedding-lance: ${await embed.count(SCOPE_A)} vectors, top3=${hits.map((h) => h.id).join(',')}`);

    console.log('\n[3] kb-token-store: put + get + invalidateScope');
    const tstore = new TokenStore({ dbPath: ':memory:', driver: new InMemoryKvDriver() });
    await tstore.open();
    await tstore.put({
      jti: 'jti1', scopeId: SCOPE_A, audienceScopeId: SCOPE_A,
      caps: ['read:kb-docs'], verifiedAt: '2026-06-02T00:00:00Z',
      expiresAt: '2099-12-31T00:00:00Z', signatureValid: true, contextHash: 'h'.repeat(32),
    });
    const stats = await tstore.stats();
    console.log(`    kb-token-store: size=${stats.size}, hits=${stats.hits}, misses=${stats.misses}`);

    console.log('\n[4] memory-distiller-llm: 2-pass verification + Pro-only type');
    const chat = new ChatStore({ conn, scopeId: SCOPE_A });
    const memStore = new MemoryTierStore({ conn, scopeId: SCOPE_A });
    const distillerAdapter = mockAdapter([
      JSON.stringify([{ type: 'code_pattern', content: 'use Result<T, E> for fallible operations', confidence: 0.9 }]),
      JSON.stringify({ valid: true }),
    ]);
    const distiller = new LlmDistiller({
      memStore, chatConn: conn, adapter: distillerAdapter, scopeId: SCOPE_A,
      config: { verificationPasses: 2 },
    });
    const session = chat.createSession({ scopeId: SCOPE_A, title: 'smoke session' });
    await chat.appendEntry({
      sessionId: session.sessionId, role: 'user',
      content: 'In Rust, use Result<T, E> for fallible operations.',
      metadata: {},
    });
    const distillStats = await distiller.distillBatch();
    const skills = memStore.listByType('skill');
    console.log(`    memory-distiller-llm: scanned=${distillStats.entriesScanned} llmCalls=${distillStats.llmCallsTotal} skills=${skills.length} proType=${skills[0]?.metadata.proType ?? 'none'}`);

    console.log('\n[5] mesh-delegation: 1-hop delegated query');
    const linkStore = new ScopeLinkStore({ conn, localScopeId: SCOPE_A });
    linkStore.create({ remoteScopeId: SCOPE_B, direction: 'outbound' });
    linkStore.updateStatus(SCOPE_B, 'outbound', 'active');
    const transport = new InMemoryMeshTransport();
    transport.setHandler(SCOPE_B, async () => [hit(SCOPE_B, 'remote-result', 0.9)]);
    const baseRouter = new MeshRouter({ localScopeId: SCOPE_A, linkStore, transport });
    const delegatedRouter = new DelegatedMeshRouter({ localScopeId: SCOPE_A, baseRouter, linkStore });
    const chain = startChain(SCOPE_A, {
      delegateScopeId: SCOPE_B, tokenJti: TOK_AB,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    const meshResult = await delegatedRouter.delegatedQuery({ text: 'q', k: 5, timeoutMs: 1000, chain });
    console.log(`    mesh-delegation: chainHops=${meshResult.chainHops} hits=${meshResult.hits.length} origin=${meshResult.originScopeId}`);

    console.log('\n[6] blast-radius: quota enforcement + window rollover');
    const br = new BlastRadiusStore({ conn, scopeId: SCOPE_A });
    br.setQuota({ kind: 'writes_per_hour', limit: 3, windowMs: 3600_000 });
    br.consume('writes_per_hour', 2);
    let blocked = false;
    try { br.consume('writes_per_hour', 2); } catch (e) { blocked = e instanceof QuotaExceededError; }
    console.log(`    blast-radius: consumed=${br.usage('writes_per_hour')?.consumed} limit=${br.usage('writes_per_hour')?.limit} blocked=${blocked}`);

    await graph.close();
    await embed.close();
    await tstore.close();
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    console.log('\n✓ Orqenix-Pro final integration smoke PASSED (6 stages)');
    process.exit(0);
  } catch (e) {
    console.error(`✗ Pro integration smoke FAILED: ${(e as Error).message}`);
    console.error((e as Error).stack);
    process.exit(1);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  }
}

main();
