// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/self-learning-advanced , AB comparator tests (store + comparator)
import { describe, it, expect } from 'vitest';
import { ABComparator } from '../src/ab-comparator';
import { ABTestStore } from '../src/ab-test-store';
import type { DetectedPattern } from '@orqenix/self-learning-detection';

function pattern(hash: string, occ: number, rate: number): DetectedPattern {
  return {
    patternHash: hash,
    actionKinds: ['x'],
    occurrenceCount: occ,
    successCount: Math.round(occ * rate),
    successRate: rate,
    avgDurationMs: 5000,
    sampleObservationIds: [],
    suggestedName: `@local/${hash}`,
    suggestedDescription: 'test',
    impactScore: 5,
  };
}

describe('ABComparator extended', () => {
  it('compares two patterns and returns confidence', () => {
    const cmp = new ABComparator();
    const a = pattern('v1', 100, 0.90);
    const b = pattern('v2', 100, 0.75);
    const result = cmp.compare(a, b);
    expect(result.confidence).toBeGreaterThan(0);
    expect(['a', 'b', 'tie']).toContain(result.winner);
  });
});

describe('ABTestStore', () => {
  it('stores and retrieves comparisons', () => {
    const store = new ABTestStore();
    const comparison = {
      variantAHash: 'a',
      variantBHash: 'b',
      variantASuccessRate: 0.9,
      variantBSuccessRate: 0.7,
      winner: 'a' as const,
      confidence: 0.85,
    };
    store.save(comparison);
    const retrieved = store.get('a', 'b');
    expect(retrieved).toBeDefined();
    expect(retrieved!.winner).toBe('a');
  });

  it('lists all stored comparisons', () => {
    const store = new ABTestStore();
    store.save({ variantAHash: 'a', variantBHash: 'b', variantASuccessRate: 0.9, variantBSuccessRate: 0.7, winner: 'a', confidence: 0.85 });
    store.save({ variantAHash: 'c', variantBHash: 'd', variantASuccessRate: 0.6, variantBSuccessRate: 0.8, winner: 'b', confidence: 0.75 });
    expect(store.list()).toHaveLength(2);
  });
});
