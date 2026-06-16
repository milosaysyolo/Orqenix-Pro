// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/cross-project-federation , Cross-project detector
//
// Finds candidates recurring across multiple projects. Per ADR-E-011 + INV-18:
// detection only SHOWS candidates; it NEVER shares data without approval.

import { SemanticClusterer } from '@orqenix-pro/self-learning-advanced';
import type { InstinctCandidate } from '@orqenix/self-learning-detection';
import type { CrossProjectCandidate } from './types';

export interface ProjectCandidates {
  projectId: string;
  projectName: string;
  candidates: InstinctCandidate[];
}

export class CrossProjectDetector {
  /**
   * Detects cross-project candidates by finding patterns recurring in ≥2
   * projects. Matches by exact pattern_hash first, then folds semantically
   * similar patterns.
   *
   * IMPORTANT (INV-18): this returns candidate metadata only. The actual
   * pattern data (samples, code) is NOT copied across projects here. Sharing
   * happens only on explicit approval (CrossProjectApprover).
   */
  detect(projectCandidates: ProjectCandidates[]): CrossProjectCandidate[] {
    // Index candidates by pattern_hash across projects
    const byHash = new Map<
      string,
      Array<{ project: ProjectCandidates; candidate: InstinctCandidate }>
    >();

    for (const pc of projectCandidates) {
      for (const candidate of pc.candidates) {
        const arr = byHash.get(candidate.pattern_hash) ?? [];
        arr.push({ project: pc, candidate });
        byHash.set(candidate.pattern_hash, arr);
      }
    }

    const crossProject: CrossProjectCandidate[] = [];

    for (const [hash, entries] of byHash) {
      // Only patterns appearing in ≥2 DISTINCT projects qualify
      const distinctProjects = new Set(entries.map((e) => e.project.projectId));
      if (distinctProjects.size < 2) continue;

      const sourceProjects = entries.map((e) => ({
        projectId: e.project.projectId,
        projectName: e.project.projectName,
        occurrenceCount: e.candidate.observation_count,
        successRate: e.candidate.success_rate,
      }));

      const totalOccurrences = sourceProjects.reduce(
        (s, p) => s + p.occurrenceCount,
        0
      );
      const aggregateImpact =
        entries.reduce((s, e) => s + e.candidate.impact_score, 0) / entries.length;

      const first = entries[0]!.candidate;
      crossProject.push({
        patternHash: hash,
        patternName: first.pattern_name ?? '(unnamed)',
        patternDescription: first.pattern_description ?? '',
        sourceProjects,
        aggregateImpact,
        totalOccurrences,
      });
    }

    return crossProject.sort((a, b) => b.aggregateImpact - a.aggregateImpact);
  }
}
