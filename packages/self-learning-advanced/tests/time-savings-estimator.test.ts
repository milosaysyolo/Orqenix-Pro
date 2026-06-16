// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/self-learning-advanced , Time-savings estimator tests
import { describe, it, expect } from 'vitest';
import { TimeSavingsEstimator } from '../src/time-savings-estimator';
import type { DetectedPattern } from '@orqenix/self-learning-detection';
import type { ObservationEvent } from '@orqenix/self-learning-observer';

function samplePattern(overrides?: Partial<DetectedPattern>): DetectedPattern {
  return {
    patternHash: 'hash1',
    actionKinds: ['edit', 'test'],
    occurrenceCount: 10,
    successCount: 9,
    successRate: 0.9,
    avgDurationMs: 5000,
    sampleObservationIds: [],
    suggestedName: '@local/test',
    suggestedDescription: 'test pattern',
    impactScore: 5,
    ...overrides,
  };
}

function sampleEvents(count: number, durationMs: number): ObservationEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `evt-${i}`,
    project_id: 'p',
    action_payload: { command: `cmd ${i}` },
    outcome_duration_ms: durationMs,
  })) as unknown as ObservationEvent[];
}

describe('TimeSavingsEstimator', () => {
  it('estimates positive time savings for automated patterns', () => {
    const estimator = new TimeSavingsEstimator();
    const pattern = samplePattern({ actionKinds: ['edit', 'test', 'commit'] });
    const events = sampleEvents(10, 60000);
    const estimate = estimator.estimate(pattern, events);
    expect(estimate.perInvocationMin).toBeGreaterThan(0);
    expect(estimate.perWeekMin).toBeGreaterThan(0);
  });

  it('returns zero savings when manual cost is below invoke overhead', () => {
    const estimator = new TimeSavingsEstimator();
    const pattern = samplePattern({ actionKinds: ['edit'] });
    const events = sampleEvents(5, 500);
    const estimate = estimator.estimate(pattern, events);
    expect(estimate.perInvocationMin).toBe(0);
  });

  it('confidence scales with sample size', () => {
    const estimator = new TimeSavingsEstimator();
    const pattern = samplePattern();
    const few = estimator.estimate(pattern, sampleEvents(5, 60000));
    const many = estimator.estimate(pattern, sampleEvents(50, 60000));
    expect(many.confidence).toBeGreaterThan(few.confidence);
  });
});
