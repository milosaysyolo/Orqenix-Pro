// SPDX-License-Identifier: BUSL-1.1
// INTEROP-2: Both OSS heuristic distiller and Pro LLM distiller use the same
// memory_distiller_watermarks table. Verify that the Pro distiller picks up
// where the OSS distiller left off, no double-processing.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HeuristicDistiller } from '@orqenix/memory-distiller';
import { LlmDistiller } from '@orqenix-pro/memory-distiller-llm';
import { makeUnifiedKB, teardownKB, makeScriptedAdapter, SCOPE_A, type UnifiedKB } from '../src/fixtures';

describe('INTEROP-2: Shared watermark between OSS + Pro distillers', () => {
  let kb: UnifiedKB;
  beforeEach(async () => { kb = await makeUnifiedKB(SCOPE_A); });
  afterEach(async () => { await teardownKB(kb); });

  it('Pro distiller resumes from where OSS heuristic distiller left off', async () => {
    const session = kb.chat.createSession({ scopeId: SCOPE_A, title: 'watermark' });
    for (let i = 0; i < 5; i++) {
      await kb.chat.appendEntry({
        sessionId: session.sessionId, role: 'user',
        content: `I prefer pattern number ${i} for runtime work`,
        metadata: {},
      });
    }

    // OSS heuristic distiller processes first 3 (batchSize=3)
    const heuristic = new HeuristicDistiller({
      memStore: kb.memStore, chatConn: kb.conn, scopeId: SCOPE_A,
      config: { batchSize: 3 } as any,
    });
    const ossStats = heuristic.distillBatch();
    expect(ossStats.entriesScanned).toBe(3);

    // Pro LLM distiller picks up entries 4-5 only
    const adapter = makeScriptedAdapter([
      JSON.stringify([{ type: 'preference', content: 'durable preference from late entry', confidence: 0.9 }]),
      JSON.stringify({ valid: true }),
    ]);
    const llm = new LlmDistiller({
      memStore: kb.memStore, chatConn: kb.conn, adapter, scopeId: SCOPE_A,
      config: { verificationPasses: 2, batchSize: 10 },
    });
    const proStats = await llm.distillBatch();
    expect(proStats.entriesScanned).toBe(2);  // only the remaining 2 entries
    // No double-processing happened
  });

  it('Pro distiller running first then OSS finds nothing', async () => {
    const session = kb.chat.createSession({ scopeId: SCOPE_A, title: 'watermark-2' });
    for (let i = 0; i < 3; i++) {
      await kb.chat.appendEntry({
        sessionId: session.sessionId, role: 'user',
        content: `entry ${i} content`,
        metadata: {},
      });
    }

    const adapter = makeScriptedAdapter([
      JSON.stringify([]),  // empty extraction, but still advances watermark
    ]);
    const llm = new LlmDistiller({
      memStore: kb.memStore, chatConn: kb.conn, adapter, scopeId: SCOPE_A,
      config: { verificationPasses: 1, batchSize: 10 },
    });
    await llm.distillBatch();

    const heuristic = new HeuristicDistiller({
      memStore: kb.memStore, chatConn: kb.conn, scopeId: SCOPE_A,
    });
    const ossStats = heuristic.distillBatch();
    expect(ossStats.entriesScanned).toBe(0);  // Pro already advanced watermark
  });

  it('content_hash idempotency holds across OSS + Pro distillation', async () => {
    const session = kb.chat.createSession({ scopeId: SCOPE_A, title: 'idem' });
    await kb.chat.appendEntry({
      sessionId: session.sessionId, role: 'user',
      content: 'I prefer Rust for runtime work',
      metadata: {},
    });

    // OSS extracts a preference
    const heuristic = new HeuristicDistiller({
      memStore: kb.memStore, chatConn: kb.conn, scopeId: SCOPE_A,
    });
    heuristic.distillBatch();
    const prefsAfterOss = kb.memStore.listByType('preference').length;
    expect(prefsAfterOss).toBeGreaterThanOrEqual(1);

    // Add same content again, Pro extracts same memory -- should be deduplicated
    await kb.chat.appendEntry({
      sessionId: session.sessionId, role: 'user',
      content: 'I prefer Rust for runtime work',  // identical
      metadata: {},
    });
    const adapter = makeScriptedAdapter([
      JSON.stringify([{ type: 'preference', content: 'I prefer Rust for runtime work', confidence: 0.9 }]),
      JSON.stringify({ valid: true }),
    ]);
    const llm = new LlmDistiller({
      memStore: kb.memStore, chatConn: kb.conn, adapter, scopeId: SCOPE_A,
      config: { verificationPasses: 2 },
    });
    const stats = await llm.distillBatch();
    expect(stats.duplicatesSkipped).toBeGreaterThanOrEqual(1);

    const prefsAfterPro = kb.memStore.listByType('preference').length;
    expect(prefsAfterPro).toBe(prefsAfterOss);  // no growth, dedup worked
  });
});
