// SPDX-License-Identifier: BUSL-1.1
// INTEROP-1: OSS ChatStore -> Pro LlmDistiller -> OSS MemoryTierStore -> OSS KeywordRecall
// Verifies that memories created by the Pro LLM distiller are immediately discoverable
// via the OSS recall API and that Pro-only types are surfaced correctly.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KeywordRecall } from '@orqenix/prompt-rewriter';
import { LlmDistiller } from '@orqenix-pro/memory-distiller-llm';
import { makeUnifiedKB, teardownKB, makeScriptedAdapter, SCOPE_A, type UnifiedKB } from '../src/fixtures';

describe('INTEROP-1: OSS ChatKB -> Pro Distiller -> OSS Recall', () => {
  let kb: UnifiedKB;
  beforeEach(async () => { kb = await makeUnifiedKB(SCOPE_A); });
  afterEach(async () => { await teardownKB(kb); });

  it('Pro distillation produces memories findable by OSS KeywordRecall', async () => {
    const session = kb.chat.createSession({ scopeId: SCOPE_A, title: 'interop-1' });
    await kb.chat.appendEntry({
      sessionId: session.sessionId, role: 'user',
      content: 'In Rust, prefer Result<T, E> for fallible operations.',
      metadata: {},
    });

    const adapter = makeScriptedAdapter([
      JSON.stringify([{
        type: 'code_pattern',
        content: 'In Rust, prefer Result<T, E> for fallible operations',
        confidence: 0.9,
      }]),
      JSON.stringify({ valid: true, reason: 'matches source' }),
    ]);
    const distiller = new LlmDistiller({
      memStore: kb.memStore, chatConn: kb.conn,
      adapter, scopeId: SCOPE_A,
      config: { verificationPasses: 2, minConfidence: 0.7 },
    });

    const stats = await distiller.distillBatch();
    expect(stats.memoriesCreated).toBeGreaterThanOrEqual(1);

    // OSS API can find the memory
    const recall = new KeywordRecall(kb.memStore, SCOPE_A);
    const hits = recall.recall('Rust Result fallible', { k: 5 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].content).toContain('Result');
    expect(hits[0].metadata.proType).toBe('code_pattern');
    expect(hits[0].metadata.isProOnlyType).toBe(true);
    // Stored as OSS 'skill' tier-type because code_pattern maps to skill
    expect(hits[0].type).toBe('skill');
  });

  it('verification rejection prevents memory creation; OSS recall finds nothing', async () => {
    const session = kb.chat.createSession({ scopeId: SCOPE_A, title: 'interop-1' });
    await kb.chat.appendEntry({
      sessionId: session.sessionId, role: 'user',
      content: 'mundane chitchat about the weather',
      metadata: {},
    });

    const adapter = makeScriptedAdapter([
      JSON.stringify([{ type: 'fact', content: 'hallucinated content not in source', confidence: 0.9 }]),
      JSON.stringify({ valid: false, reason: 'not derivable from source' }),
    ]);
    const distiller = new LlmDistiller({
      memStore: kb.memStore, chatConn: kb.conn, adapter, scopeId: SCOPE_A,
      config: { verificationPasses: 2 },
    });
    await distiller.distillBatch();

    const recall = new KeywordRecall(kb.memStore, SCOPE_A);
    expect(recall.recall('hallucinated', { k: 5 })).toEqual([]);
    expect(kb.memStore.countByTier()).toEqual({ working: 0, episodic: 0, semantic: 0, procedural: 0 });
  });

  it('Pro types code_pattern/anti_pattern/troubleshooting all stored as OSS skill/learning/skill', async () => {
    const session = kb.chat.createSession({ scopeId: SCOPE_A, title: 'interop-1' });
    await kb.chat.appendEntry({
      sessionId: session.sessionId, role: 'user',
      content: 'Mixed advice about Rust patterns.',
      metadata: {},
    });

    const adapter = makeScriptedAdapter([
      JSON.stringify([
        { type: 'code_pattern',  content: 'use Result<T, E> for fallible operations', confidence: 0.9 },
        { type: 'anti_pattern',  content: 'avoid panic in library code',               confidence: 0.85 },
        { type: 'troubleshooting', content: 'when borrow checker complains, simplify lifetimes', confidence: 0.8 },
      ]),
      JSON.stringify({ valid: true }),
      JSON.stringify({ valid: true }),
      JSON.stringify({ valid: true }),
    ]);
    const distiller = new LlmDistiller({
      memStore: kb.memStore, chatConn: kb.conn, adapter, scopeId: SCOPE_A,
      config: { verificationPasses: 2 },
    });
    await distiller.distillBatch();

    const skills = kb.memStore.listByType('skill');
    const learnings = kb.memStore.listByType('learning');
    // code_pattern -> skill, troubleshooting -> skill
    expect(skills.length).toBeGreaterThanOrEqual(2);
    // anti_pattern -> learning
    expect(learnings.length).toBeGreaterThanOrEqual(1);
    // Pro types preserved
    const proTypes = [...skills, ...learnings].map((m) => m.metadata.proType).sort();
    expect(proTypes).toEqual(['anti_pattern', 'code_pattern', 'troubleshooting'].sort());
  });
});
