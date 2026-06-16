// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/self-learning-advanced , A/B comparator
//
// Compares two pattern variants by success rate with confidence. Pro feature.

import type { DetectedPattern } from '@orqenix/self-learning-detection';
import type { ABComparison } from './types';

export class ABComparator {
  /**
   * Compares two pattern variants. Uses a simple proportion-difference test to
   * estimate confidence that one variant outperforms the other.
   */
  compare(a: DetectedPattern, b: DetectedPattern): ABComparison {
    const rateA = a.successRate;
    const rateB = b.successRate;
    const nA = a.occurrenceCount;
    const nB = b.occurrenceCount;

    const diff = Math.abs(rateA - rateB);
    // Pooled standard error for two proportions
    const pooled = (a.successCount + b.successCount) / (nA + nB);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
    // z-score → confidence (approx, capped 0-1)
    const z = se > 0 ? diff / se : 0;
    const confidence = Math.min(1, z / 3); // ~3 SE ≈ high confidence

    let winner: 'a' | 'b' | 'tie';
    if (diff < 0.05 || confidence < 0.5) {
      winner = 'tie';
    } else {
      winner = rateA > rateB ? 'a' : 'b';
    }

    return {
      variantAHash: a.patternHash,
      variantBHash: b.patternHash,
      variantASuccessRate: rateA,
      variantBSuccessRate: rateB,
      winner,
      confidence,
    };
  }
}
