// SPDX-License-Identifier: BUSL-1.1
// INTEROP-8: Pro packages (blast-radius, mesh-delegation) emit lifecycle events
// that the OSS AuditLogStore records, preserving the hash chain.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startChain } from '@orqenix-pro/mesh-delegation';
import { QuotaExceededError } from '@orqenix-pro/blast-radius';
import { makeUnifiedKB, teardownKB, SCOPE_A, SCOPE_B, TOK_AB, type UnifiedKB } from '../src/fixtures';

describe('INTEROP-8: OSS audit log records OSS + Pro events in one chain', () => {
  let kb: UnifiedKB;
  beforeEach(async () => { kb = await makeUnifiedKB(SCOPE_A); });
  afterEach(async () => { await teardownKB(kb); });

  it('OSS link lifecycle + Pro quota events + Pro delegation events all in one verified chain', async () => {
    // OSS: scope init + link created
    kb.auditStore.append({ actorScopeId: SCOPE_A, eventKind: 'scope_initialized', payload: {} });
    kb.linkStore.create({ remoteScopeId: SCOPE_B, direction: 'outbound' });
    kb.auditStore.append({ actorScopeId: SCOPE_A, eventKind: 'link_created', payload: { remote: SCOPE_B } });

    // Pro: configure blast-radius
    kb.blastRadius.setQuota({ kind: 'writes_per_hour', limit: 1, windowMs: 3_600_000 });
    kb.auditStore.append({
      actorScopeId: SCOPE_A, eventKind: 'kb_write',
      payload: { brAction: 'set_quota', kind: 'writes_per_hour', limit: 1 },
    });

    // Pro: consume + reject
    kb.blastRadius.consume('writes_per_hour', 1);
    let rejection: QuotaExceededError | null = null;
    try { kb.blastRadius.consume('writes_per_hour', 1); }
    catch (e) { rejection = e as QuotaExceededError; }
    if (rejection) {
      kb.auditStore.append({
        actorScopeId: SCOPE_A, eventKind: 'kb_write',
        payload: { brAction: 'rejected_by_quota', kind: rejection.kind, limit: rejection.limit, attempted: rejection.attempted },
      });
    }

    // Pro: delegation chain started
    const chain = startChain(SCOPE_A, {
      delegateScopeId: SCOPE_B, tokenJti: TOK_AB,
      caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    kb.auditStore.append({
      actorScopeId: SCOPE_A, eventKind: 'mesh_query_run',
      payload: {
        delegationStarted: true, chainLength: chain.steps.length,
        firstDelegate: chain.steps[0].delegateScopeId,
        tokenJti: chain.steps[0].tokenJti,
      },
    });

    // Verify entire chain
    const result = kb.auditStore.verifyChain();
    expect(result.ok).toBe(true);
    expect(result.entriesChecked).toBe(5);

    // Each event kind appears the expected number of times
    expect(kb.auditStore.list({ kind: 'kb_write' }).length).toBe(2);
    expect(kb.auditStore.list({ kind: 'mesh_query_run' }).length).toBe(1);
    expect(kb.auditStore.list({ kind: 'link_created' }).length).toBe(1);
  });

  it('tampering a Pro-event payload breaks the OSS verifyChain', () => {
    kb.auditStore.append({ actorScopeId: SCOPE_A, eventKind: 'scope_initialized', payload: {} });
    kb.auditStore.append({
      actorScopeId: SCOPE_A, eventKind: 'kb_write',
      payload: { brAction: 'set_quota', kind: 'writes_per_hour', limit: 100 },
    });
    kb.auditStore.append({ actorScopeId: SCOPE_A, eventKind: 'kb_write', payload: { source: 'oss-normal' } });

    // Tamper the Pro event payload (rowid=2)
    kb.conn.prepare(`UPDATE audit_log_entries SET payload_json = '{"tampered":true}' WHERE rowid = 2`).run();

    expect(() => kb.auditStore.verifyChain()).toThrow();
  });
});
