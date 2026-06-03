// SPDX-License-Identifier: BUSL-1.1
// INTEROP-4: Pro BlastRadiusStore acts as the gate for OSS write operations.
// Wrap OSS ChatStore.appendEntry calls with quota consumption checks.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QuotaExceededError, DEFAULT_QUOTAS } from '@orqenix-pro/blast-radius';
import { makeUnifiedKB, teardownKB, SCOPE_A, type UnifiedKB } from '../src/fixtures';

describe('INTEROP-4: Pro blast-radius gates OSS write operations', () => {
  let kb: UnifiedKB;
  beforeEach(async () => { kb = await makeUnifiedKB(SCOPE_A); });
  afterEach(async () => { await teardownKB(kb); });

  // A small wrapper that consults blast-radius before invoking the OSS write.
  async function gatedAppend(kb: UnifiedKB, sessionId: string, content: string): Promise<void> {
    kb.blastRadius.consume('writes_per_hour', 1);
    await kb.chat.appendEntry({
      sessionId: sessionId as any, role: 'user', content, metadata: {},
    });
  }

  it('quota limits OSS ChatStore writes', async () => {
    kb.blastRadius.setQuota({ kind: 'writes_per_hour', limit: 3, windowMs: 3_600_000 });
    const session = kb.chat.createSession({ scopeId: SCOPE_A, title: 'gated' });

    await gatedAppend(kb, session.sessionId, 'message 1');
    await gatedAppend(kb, session.sessionId, 'message 2');
    await gatedAppend(kb, session.sessionId, 'message 3');

    await expect(gatedAppend(kb, session.sessionId, 'message 4')).rejects.toThrow(QuotaExceededError);
    // OSS state is unchanged on the 4th attempt because gating happened pre-write
    expect(kb.chat.listEntries(session.sessionId).length).toBe(3);
  });

  it('DEFAULT_QUOTAS applied as preset baseline', () => {
    for (const q of DEFAULT_QUOTAS) kb.blastRadius.setQuota(q);
    const all = kb.blastRadius.listQuotas();
    expect(all.length).toBe(5);
    const writesPerHour = kb.blastRadius.getQuota('writes_per_hour');
    expect(writesPerHour?.limit).toBe(5_000);
    const detachPerDay = kb.blastRadius.getQuota('detach_per_day');
    expect(detachPerDay?.limit).toBe(10);
  });

  it('cross_scope_writes_per_hour gates mesh writes specifically', async () => {
    kb.blastRadius.setQuota({ kind: 'cross_scope_writes_per_hour', limit: 2, windowMs: 3_600_000 });
    kb.blastRadius.consume('cross_scope_writes_per_hour', 1);
    kb.blastRadius.consume('cross_scope_writes_per_hour', 1);
    expect(() => kb.blastRadius.consume('cross_scope_writes_per_hour', 1)).toThrow(QuotaExceededError);
    // writes_per_hour quota is untouched (different bucket)
    kb.blastRadius.setQuota({ kind: 'writes_per_hour', limit: 100, windowMs: 3_600_000 });
    const u = kb.blastRadius.consume('writes_per_hour', 1);
    expect(u.consumed).toBe(1);
  });

  it('audit log records the quota-rejected attempt context', () => {
    kb.blastRadius.setQuota({ kind: 'writes_per_hour', limit: 1, windowMs: 3_600_000 });
    kb.blastRadius.consume('writes_per_hour', 1);

    let caught: QuotaExceededError | null = null;
    try { kb.blastRadius.consume('writes_per_hour', 1); }
    catch (e) { caught = e as QuotaExceededError; }
    expect(caught).toBeInstanceOf(QuotaExceededError);

    if (caught) {
      kb.auditStore.append({
        actorScopeId: SCOPE_A, eventKind: 'kb_write',
        payload: { brAction: 'rejected_by_quota', kind: caught.kind, limit: caught.limit, attempted: caught.attempted },
      });
    }

    const audits = kb.auditStore.list({ kind: 'kb_write' });
    expect(audits.length).toBe(1);
    expect(audits[0].payload.brAction).toBe('rejected_by_quota');
    // Chain still valid
    expect(kb.auditStore.verifyChain().ok).toBe(true);
  });
});
