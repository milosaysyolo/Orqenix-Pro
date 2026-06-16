// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/self-learning-advanced , Time-savings estimator
//
// Accurate per-action timing model. Pro feature (basic estimate is in OSS).

import type { ObservationEvent } from '@orqenix/self-learning-observer';
import type { DetectedPattern } from '@orqenix/self-learning-detection';
import type { TimeSavingsEstimate } from './types';

export class TimeSavingsEstimator {
  /** Skill invocation overhead (ms) */
  private readonly invokeCostMs = 1500;

  /**
   * Estimates time saved by automating a pattern. Uses observed per-action
   * durations to model the full manual cost, minus the skill invoke overhead.
   */
  estimate(
    pattern: DetectedPattern,
    events: ObservationEvent[]
  ): TimeSavingsEstimate {
    // Average manual duration of the pattern from observed events
    const relevant = events.filter((e) => e.outcome_duration_ms !== null);
    const avgActionMs =
      relevant.length > 0
        ? relevant.reduce((s, e) => s + (e.outcome_duration_ms ?? 0), 0) / relevant.length
        : 0;

    const manualMs = avgActionMs * pattern.actionKinds.length;
    const perInvocationMs = Math.max(0, manualMs - this.invokeCostMs);
    const perInvocationMin = perInvocationMs / 60000;

    // Frequency normalized to per-week (assume observations span ~1 week)
    const perWeekMin = perInvocationMin * pattern.occurrenceCount;

    // Confidence scales with sample size
    const confidence = Math.min(1, relevant.length / 20);

    return {
      patternHash: pattern.patternHash,
      perInvocationMin: Math.round(perInvocationMin * 10) / 10,
      perWeekMin: Math.round(perWeekMin),
      confidence,
    };
  }
}
