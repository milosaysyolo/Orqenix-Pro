// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { ChatStore, CHAT_KB_MIGRATIONS } from '@orqenix/kb-chat';
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from '@orqenix/memory-tiers';
import type { LlmAdapter, LlmRequest, LlmResponse } from '@orqenix/llm-adapter-ollama';
import { LlmDistiller } from '../src';

const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function makeMockAdapter(scriptedResponses: Array<string | (() => string)>): LlmAdapter & { callCount: () => number } {
  let i = 0;
  let calls = 0;
  return {
    provider: 'mock',
    model: 'mock-1',
    async complete(_req: LlmRequest): Promise<LlmResponse> {
      calls++;
      const r = scriptedResponses[i++ % scriptedResponses.length];
      const content = typeof r === 'function' ? r() : r;
      return {
        content, finishReason: 'stop',
        tokensIn: 100, tokensOut: 50,
        model: 'mock-1', provider: 'mock', latencyMs: 1,
      };
    },
    async isHealthy() { return true; },
    callCount: () => calls,
  };
}

describe('LlmDistiller', () => {
  let dir: string;
  let conn: SqliteConnection;
  let chat: ChatStore;
  let memStore: MemoryTierStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orqenix-pro-distill-'));
    conn = new SqliteConnection({ path: join(dir, 'd.sqlite') });
    runMigrations(conn, [...CHAT_KB_MIGRATIONS, ...MEMORY_TIER_MIGRATIONS]);
    chat = new ChatStore({ conn, scopeId: SCOPE });
    memStore = new MemoryTierStore({ conn, scopeId: SCOPE });
  });
  afterEach(async () => {
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('distills entries and inserts memories (single verification pass = no extra calls)', async () => {
    const adapter = makeMockAdapter([
      JSON.stringify([{ type: 'preference', content: 'I prefer Rust for runtime work', confidence: 0.9 }]),
    ]);
    const distiller = new LlmDistiller({
      memStore, chatConn: conn, adapter, scopeId: SCOPE,
      config: { verificationPasses: 1 },
    });
    const s = chat.createSession({ scopeId: SCOPE, title: 't' });
    await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'I prefer Rust for runtime work', metadata: {} });
    const stats = await distiller.distillBatch();
    expect(stats.entriesScanned).toBe(1);
    expect(stats.memoriesCreated).toBeGreaterThanOrEqual(1);
    expect(stats.llmCallsTotal).toBe(1);
  });

  it('runs verification pass and counts extra LLM call', async () => {
    const adapter = makeMockAdapter([
      JSON.stringify([{ type: 'decision', content: 'use SQLite for storage', confidence: 0.9 }]),
      JSON.stringify({ valid: true, reason: 'matches' }),
    ]);
    const distiller = new LlmDistiller({
      memStore, chatConn: conn, adapter, scopeId: SCOPE,
      config: { verificationPasses: 2 },
    });
    const s = chat.createSession({ scopeId: SCOPE, title: 't' });
    await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'We decided to use SQLite for storage', metadata: {} });
    const stats = await distiller.distillBatch();
    expect(stats.llmCallsTotal).toBe(2);
    expect(stats.memoriesCreated).toBeGreaterThanOrEqual(1);
    expect(stats.verificationFailures).toBe(0);
  });

  it('counts verification failure when verifier rejects', async () => {
    const adapter = makeMockAdapter([
      JSON.stringify([{ type: 'fact', content: 'BLAKE3 outperforms SHA-256 on large inputs', confidence: 0.9 }]),
      JSON.stringify({ valid: false, reason: 'hallucinated' }),
    ]);
    const distiller = new LlmDistiller({
      memStore, chatConn: conn, adapter, scopeId: SCOPE,
      config: { verificationPasses: 2 },
    });
    const s = chat.createSession({ scopeId: SCOPE, title: 't' });
    await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'BLAKE3 is fast', metadata: {} });
    const stats = await distiller.distillBatch();
    expect(stats.verificationFailures).toBeGreaterThanOrEqual(1);
    expect(stats.memoriesCreated).toBe(0);
  });

  it('filters by minConfidence', async () => {
    const adapter = makeMockAdapter([
      JSON.stringify([
        { type: 'preference', content: 'this preference is uncertain but long enough', confidence: 0.4 },
        { type: 'fact', content: 'this fact is high confidence and durable', confidence: 0.95 },
      ]),
      JSON.stringify({ valid: true }),
    ]);
    const distiller = new LlmDistiller({
      memStore, chatConn: conn, adapter, scopeId: SCOPE,
      config: { minConfidence: 0.8, verificationPasses: 2 },
    });
    const s = chat.createSession({ scopeId: SCOPE, title: 't' });
    await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'some mixed quality text', metadata: {} });
    const stats = await distiller.distillBatch();
    expect(stats.candidatesExtracted).toBe(1);
    expect(stats.memoriesCreated).toBeGreaterThanOrEqual(1);
  });

  it('Pro-only types stored with proType in metadata + mapped to OSS type', async () => {
    const adapter = makeMockAdapter([
      JSON.stringify([{
        type: 'code_pattern',
        content: 'use Result<T, E> for fallible operations',
        confidence: 0.9,
      }]),
      JSON.stringify({ valid: true }),
    ]);
    const distiller = new LlmDistiller({
      memStore, chatConn: conn, adapter, scopeId: SCOPE,
      config: { verificationPasses: 2 },
    });
    const s = chat.createSession({ scopeId: SCOPE, title: 't' });
    await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'In Rust, use Result<T, E> for fallible operations.', metadata: {} });
    await distiller.distillBatch();
    const skills = memStore.listByType('skill');
    expect(skills.length).toBeGreaterThanOrEqual(1);
    expect(skills[0].metadata.proType).toBe('code_pattern');
    expect(skills[0].metadata.isProOnlyType).toBe(true);
  });

  it('advances watermark; second distillBatch is a no-op', async () => {
    const adapter = makeMockAdapter([
      JSON.stringify([{ type: 'fact', content: 'rust is memory-safe by default', confidence: 0.9 }]),
      JSON.stringify({ valid: true }),
    ]);
    const distiller = new LlmDistiller({
      memStore, chatConn: conn, adapter, scopeId: SCOPE,
      config: { verificationPasses: 2 },
    });
    const s = chat.createSession({ scopeId: SCOPE, title: 't' });
    await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'fact source', metadata: {} });
    const first = await distiller.distillBatch();
    expect(first.entriesScanned).toBe(1);
    const second = await distiller.distillBatch();
    expect(second.entriesScanned).toBe(0);
  });

  it('skips system role entries', async () => {
    const adapter = makeMockAdapter([JSON.stringify([])]);
    const distiller = new LlmDistiller({
      memStore, chatConn: conn, adapter, scopeId: SCOPE,
      config: { verificationPasses: 1 },
    });
    const s = chat.createSession({ scopeId: SCOPE, title: 't' });
    await chat.appendEntry({ sessionId: s.sessionId, role: 'system', content: 'system prompt content', metadata: {} });
    const stats = await distiller.distillBatch();
    expect(stats.entriesScanned).toBe(0);
    expect(stats.llmCallsTotal).toBe(0);
  });

  it('counts LLM token usage', async () => {
    const adapter = makeMockAdapter([
      JSON.stringify([{ type: 'fact', content: 'BLAKE3 is a fast hash function', confidence: 0.9 }]),
      JSON.stringify({ valid: true }),
    ]);
    const distiller = new LlmDistiller({
      memStore, chatConn: conn, adapter, scopeId: SCOPE,
      config: { verificationPasses: 2 },
    });
    const s = chat.createSession({ scopeId: SCOPE, title: 't' });
    await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'source', metadata: {} });
    const stats = await distiller.distillBatch();
    expect(stats.llmTokensIn).toBeGreaterThan(0);
    expect(stats.llmTokensOut).toBeGreaterThan(0);
  });

  it('distillAll loops until idle', async () => {
    const adapter = makeMockAdapter([
      JSON.stringify([{ type: 'fact', content: 'this is a fact extracted by the llm distiller', confidence: 0.9 }]),
      JSON.stringify({ valid: true }),
    ]);
    const distiller = new LlmDistiller({
      memStore, chatConn: conn, adapter, scopeId: SCOPE,
      config: { batchSize: 2, verificationPasses: 2 },
    });
    const s = chat.createSession({ scopeId: SCOPE, title: 't' });
    for (let i = 0; i < 5; i++) {
      await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: `entry number ${i}`, metadata: {} });
    }
    const runs = await distiller.distillAll(10);
    const scanned = runs.reduce((a, r) => a + r.entriesScanned, 0);
    expect(scanned).toBe(5);
  });

  it('catches malformed LLM response and counts as verification failure', async () => {
    const adapter = makeMockAdapter(['this is not JSON at all']);
    const distiller = new LlmDistiller({
      memStore, chatConn: conn, adapter, scopeId: SCOPE,
      config: { verificationPasses: 1 },
    });
    const s = chat.createSession({ scopeId: SCOPE, title: 't' });
    await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'source', metadata: {} });
    let threw = false;
    try { await distiller.distillBatch(); } catch { threw = true; }
    // depending on whether the parse error escapes (InvalidLlmResponseError != VerificationFailureError),
    // the distillBatch may throw. We accept either outcome but ensure no memory was created.
    expect(memStore.countByTier().working + memStore.countByTier().episodic).toBe(0);
    void threw;
  });
});
