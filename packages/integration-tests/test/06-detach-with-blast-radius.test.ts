// SPDX-License-Identifier: BUSL-1.1
// INTEROP-6: OSS DetachExecutor respects Pro blast-radius detach_per_day quota.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DetachPlanner, DetachExecutor } from '@orqenix/detach';
import { QuotaExceededError } from '@orqenix-pro/blast-radius';
import { makeUnifiedKB, teardownKB, SCOPE_A, SCOPE_B, SCOPE_C, type UnifiedKB } from '../src/fixtures';

describe('INTEROP-6: OSS Detach + Pro blast-radius quota', () => {
  let kb: UnifiedKB;
  beforeEach(async () => { kb = await makeUnifiedKB(SCOPE_A); });
  afterEach(async () => { await teardownKB(kb); });

  async function gatedDetach(remote: string): Promise<void> {
    // Caller pattern: consume Pro quota first, then perform OSS detach.
    kb.blastRadius.consume('detach_per_day', 1);
    const planner = new DetachPlanner({
      localScopeId: SCOPE_A, linkStore: kb.linkStore,
      workspaceStore: kb.workspaceStore, auditStore: kb.auditStore,
    });
    const executor = new DetachExecutor({
      localScopeId: SCOPE_A, linkStore: kb.linkStore,
      workspaceStore: kb.workspaceStore, auditStore: kb.auditStore,
      rootDir: kb.dir,
    });
    const plan = planner.planUnlink(remote);
    await executor.execute(plan, plan.confirmationToken);
  }

  it('detach_per_day=2 allows 2 unlinks then blocks the 3rd', async () => {
    kb.blastRadius.setQuota({ kind: 'detach_per_day', limit: 2, windowMs: 86_400_000 });

    kb.linkStore.create({ remoteScopeId: SCOPE_B, direction: 'outbound' });
    kb.linkStore.updateStatus(SCOPE_B, 'outbound', 'active');
    kb.linkStore.create({ remoteScopeId: SCOPE_C, direction: 'outbound' });
    kb.linkStore.updateStatus(SCOPE_C, 'outbound', 'active');

    await gatedDetach(SCOPE_B);
    expect(kb.linkStore.get(SCOPE_B, 'outbound').status).toBe('revoked');

    await gatedDetach(SCOPE_C);
    expect(kb.linkStore.get(SCOPE_C, 'outbound').status).toBe('revoked');

    // 3rd attempt blocked (no more quota)
    kb.linkStore.create({ remoteScopeId: 'scope:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', direction: 'outbound' });
    kb.linkStore.updateStatus('scope:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', 'outbound', 'active');
    await expect(gatedDetach('scope:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD')).rejects.toThrow(QuotaExceededError);
  });

  it('OSS dryRun detach still consumes Pro quota (callers can opt out)', async () => {
    kb.blastRadius.setQuota({ kind: 'detach_per_day', limit: 1, windowMs: 86_400_000 });
    kb.linkStore.create({ remoteScopeId: SCOPE_B, direction: 'outbound' });
    kb.linkStore.updateStatus(SCOPE_B, 'outbound', 'active');

    // Custom gated dry-run path: consume + dryRun
    kb.blastRadius.consume('detach_per_day', 1);
    const planner = new DetachPlanner({ localScopeId: SCOPE_A, linkStore: kb.linkStore, workspaceStore: kb.workspaceStore, auditStore: kb.auditStore });
    const executor = new DetachExecutor({ localScopeId: SCOPE_A, linkStore: kb.linkStore, workspaceStore: kb.workspaceStore, auditStore: kb.auditStore, rootDir: kb.dir });
    const plan = planner.planUnlink(SCOPE_B);
    await executor.execute(plan, plan.confirmationToken, { dryRun: true });

    // Link still active (dry-run did not mutate)
    expect(kb.linkStore.get(SCOPE_B, 'outbound').status).toBe('active');
    // But quota was consumed
    expect(kb.blastRadius.usage('detach_per_day')?.consumed).toBe(1);
    // And next non-dry-run attempt is blocked
    await expect(gatedDetach(SCOPE_B)).rejects.toThrow(QuotaExceededError);
  });
});
