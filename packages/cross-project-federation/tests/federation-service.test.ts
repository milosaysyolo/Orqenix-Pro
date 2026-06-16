// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/cross-project-federation , Federation service tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FederationService } from '../src/federation-service';
import type { ProjectCandidates } from '../src/cross-project-detector';
import type { InstinctCandidate } from '@orqenix/self-learning-detection';

function candidate(hash: string, impact: number): InstinctCandidate {
  return {
    id: `c-${hash}`,
    project_id: 'p1',
    branch_id: null,
    session_id: null,
    pattern_hash: hash,
    pattern_name: 'test',
    pattern_description: 'desc',
    observation_count: 10,
    success_count: 9,
    total_count: 10,
    success_rate: 0.9,
    sample_observation_ids: '[]',
    detected_at: '2026-06-11T10:00:00Z',
    impact_score: impact,
    status: 'detected',
    reviewed_at: null,
    reviewed_by: null,
    review_decision: null,
    cross_scope: false,
    cross_scope_sources_json: null,
  };
}

describe('FederationService (facade)', () => {
  let tmpDir: string;
  let service: FederationService;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-fed-svc-'));
    service = new FederationService({
      approvalsPath: join(tmpDir, 'approvals.yaml'),
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('detectCrossProject returns candidates', () => {
    const projects: ProjectCandidates[] = [
      { projectId: 'p1', projectName: 'One', candidates: [candidate('h', 8)] },
      { projectId: 'p2', projectName: 'Two', candidates: [candidate('h', 6)] },
    ];
    const result = service.detectCrossProject(projects);
    expect(result).toHaveLength(1);
  });

  it('approve + isApproved roundtrip', async () => {
    const result = await service.approve({ sourceProjectId: 'p1', targetProjectId: 'p2', patternHash: 'h', approvedBy: 'milo' });
    expect(result.ok).toBe(true);
    const approved = await service.isApproved({ sourceProjectId: 'p1', targetProjectId: 'p2', patternHash: 'h' });
    expect(approved).toBe(true);
  });

  it('getApprover returns the underlying approver', () => {
    const approver = service.getApprover();
    expect(typeof approver.approve).toBe('function');
    expect(typeof approver.isApproved).toBe('function');
  });
});
