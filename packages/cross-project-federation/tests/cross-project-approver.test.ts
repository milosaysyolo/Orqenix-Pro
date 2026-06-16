// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CrossProjectApprover, NoopFederationAuditWriter } from '../src/cross-project-approver';

describe('CrossProjectApprover (INV-18)', () => {
  let tmpDir: string;
  let approver: CrossProjectApprover;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-fed-'));
    approver = new CrossProjectApprover({
      approvalsPath: join(tmpDir, 'federation-approvals.yaml'),
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('not approved by default (INV-18)', async () => {
    const approved = await approver.isApproved({
      sourceProjectId: 'p1',
      targetProjectId: 'p2',
      patternHash: 'h',
    });
    expect(approved).toBe(false);
  });

  it('approves a cross-project share', async () => {
    const result = await approver.approve({
      sourceProjectId: 'p1',
      targetProjectId: 'p2',
      patternHash: 'h',
      approvedBy: 'milo',
    });
    expect(result.ok).toBe(true);
    expect(result.sharedToProject).toBe('p2');

    const approved = await approver.isApproved({
      sourceProjectId: 'p1',
      targetProjectId: 'p2',
      patternHash: 'h',
    });
    expect(approved).toBe(true);
  });

  it('audits the approval', async () => {
    const events: Array<{ kind: string }> = [];
    const audit = { append: async (e: { kind: string }) => { events.push(e); } };
    const a = new CrossProjectApprover({
      approvalsPath: join(tmpDir, 'approvals2.yaml'),
      audit: audit as never,
    });
    await a.approve({ sourceProjectId: 'p1', targetProjectId: 'p2', patternHash: 'h', approvedBy: 'milo' });
    expect(events.some((e) => e.kind === 'memory.promoted.project_to_cross_project')).toBe(true);
  });

  it('expired approval is not valid', async () => {
    await approver.approve({
      sourceProjectId: 'p1',
      targetProjectId: 'p2',
      patternHash: 'h',
      approvedBy: 'milo',
      expiresAtIso: new Date(Date.now() - 1000).toISOString(), // already expired
    });
    const approved = await approver.isApproved({
      sourceProjectId: 'p1',
      targetProjectId: 'p2',
      patternHash: 'h',
    });
    expect(approved).toBe(false);
  });

  it('revoke removes approval', async () => {
    await approver.approve({ sourceProjectId: 'p1', targetProjectId: 'p2', patternHash: 'h', approvedBy: 'milo' });
    await approver.revoke({ sourceProjectId: 'p1', targetProjectId: 'p2', patternHash: 'h' });
    const approved = await approver.isApproved({ sourceProjectId: 'p1', targetProjectId: 'p2', patternHash: 'h' });
    expect(approved).toBe(false);
  });
});
