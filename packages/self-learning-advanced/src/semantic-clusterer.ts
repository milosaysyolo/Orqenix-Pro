// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/self-learning-advanced , Semantic clusterer
//
// Groups similar (not identical) sequences into clusters. Pro feature.

import type { DetectedPattern } from '@orqenix/self-learning-detection';
import type { SemanticCluster } from './types';

export class SemanticClusterer {
  constructor(private readonly similarityThreshold = 0.7) {}

  /**
   * Clusters patterns by sequence similarity. Patterns whose action-kind
   * sequences are similar (Jaccard over action-kind n-grams) above threshold
   * are folded into a single cluster represented by the highest-impact member.
   */
  cluster(patterns: DetectedPattern[]): SemanticCluster[] {
    const clusters: SemanticCluster[] = [];
    const assigned = new Set<string>();

    // Sort by impact so representatives are highest-impact
    const sorted = [...patterns].sort((a, b) => b.impactScore - a.impactScore);

    for (const pattern of sorted) {
      if (assigned.has(pattern.patternHash)) continue;

      const members: string[] = [pattern.patternHash];
      const similarities: number[] = [];
      assigned.add(pattern.patternHash);

      for (const other of sorted) {
        if (assigned.has(other.patternHash)) continue;
        const sim = this.similarity(pattern.actionKinds, other.actionKinds);
        if (sim >= this.similarityThreshold) {
          members.push(other.patternHash);
          similarities.push(sim);
          assigned.add(other.patternHash);
        }
      }

      const cohesion =
        similarities.length > 0
          ? similarities.reduce((s, x) => s + x, 0) / similarities.length
          : 1.0;

      clusters.push({ representative: pattern, memberHashes: members, cohesion });
    }

    return clusters;
  }

  /** Jaccard similarity over action-kind sets */
  private similarity(a: string[], b: string[]): number {
    return this.jaccard(new Set(a), new Set(b));
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    let intersection = 0;
    for (const x of a) if (b.has(x)) intersection += 1;
    const union = a.size + b.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}
