// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { CrossProjectDetector, type ProjectCandidates } from '../src/cross-project-detector';
import type { InstinctCandidate } from '@orqenix/self-learning-detection';

function candidate(hash: string, name: string, occ: number, rate: number, impact: number): InstinctCandidate {
  return {
    id: `c-${hash}`,
    project_id: 'will-be-overridden',
    branch_id: null,
    session_id: null,
    pattern_hash: hash,
    pattern_name: name,
    pattern_description: 'desc',
    observation_count: occ,
    success_count: Math.round(occ * rate),
    total_count: occ,
    success_rate: rate,
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

describe('CrossProjectDetector', () => {
  it('detects a pattern recurring in 2 projects', () => {
    const detector = new CrossProjectDetector();
    const projects: ProjectCandidates[] = [
      { projectId: 'p1', projectName: 'Project One', candidates: [candidate('shared', 'test-commit', 10, 1.0, 8)] },
      { projectId: 'p2', projectName: 'Project Two', candidates: [candidate('shared', 'test-commit', 6, 0.9, 6)] },
    ];
    const result = detector.detect(projects);
    expect(result).toHaveLength(1);
    expect(result[0]?.sourceProjects).toHaveLength(2);
    expect(result[0]?.totalOccurrences).toBe(16);
  });

  it('ignores patterns in only 1 project (INV-18: not cross-project)', () => {
    const detector = new CrossProjectDetector();
    const projects: ProjectCandidates[] = [
      { projectId: 'p1', projectName: 'One', candidates: [candidate('solo', 'x', 10, 1.0, 8)] },
      { projectId: 'p2', projectName: 'Two', candidates: [candidate('other', 'y', 6, 0.9, 6)] },
    ];
    const result = detector.detect(projects);
    expect(result).toHaveLength(0); // no shared pattern
  });

  it('does NOT copy pattern data on detection (INV-18)', () => {
    const detector = new CrossProjectDetector();
    const projects: ProjectCandidates[] = [
      { projectId: 'p1', projectName: 'One', candidates: [candidate('s', 'x', 10, 1.0, 8)] },
      { projectId: 'p2', projectName: 'Two', candidates: [candidate('s', 'x', 6, 0.9, 6)] },
    ];
    const result = detector.detect(projects);
    // Result has metadata only , no sample_observation_ids / code copied across
    expect(result[0]).not.toHaveProperty('sample_observation_ids');
    expect(result[0]).toHaveProperty('sourceProjects');
  });

  it('ranks by aggregate impact', () => {
    const detector = new CrossProjectDetector();
    const projects: ProjectCandidates[] = [
      {
        projectId: 'p1',
        projectName: 'One',
        candidates: [candidate('low', 'a', 5, 1.0, 3), candidate('high', 'b', 20, 1.0, 9)],
      },
      {
        projectId: 'p2',
        projectName: 'Two',
        candidates: [candidate('low', 'a', 5, 1.0, 3), candidate('high', 'b', 20, 1.0, 9)],
      },
    ];
    const result = detector.detect(projects);
    expect(result[0]?.patternHash).toBe('high');
  });
});
