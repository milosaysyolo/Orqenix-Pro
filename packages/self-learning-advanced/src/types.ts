// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/self-learning-advanced , Type definitions

import type { DetectedPattern } from '@orqenix/self-learning-detection';

/** A template extracted from parameterized variations */
export interface ExtractedTemplate {
  /** Template with placeholders, e.g., "git commit -m {message}" */
  template: string;
  /** Parameter names found in the template */
  parameters: string[];
  /** Occurrences matching this template */
  occurrenceCount: number;
  successRate: number;
}

/** A semantic cluster of similar (not identical) sequences */
export interface SemanticCluster {
  /** Representative pattern */
  representative: DetectedPattern;
  /** Members folded into this cluster */
  memberHashes: string[];
  /** Average pairwise similarity */
  cohesion: number;
}

/** A/B comparison result between two pattern variants */
export interface ABComparison {
  variantAHash: string;
  variantBHash: string;
  variantASuccessRate: number;
  variantBSuccessRate: number;
  /** Which variant performs better */
  winner: 'a' | 'b' | 'tie';
  /** Statistical confidence 0-1 */
  confidence: number;
}

/** Advanced time-savings estimate */
export interface TimeSavingsEstimate {
  patternHash: string;
  /** Estimated minutes saved per invocation */
  perInvocationMin: number;
  /** Estimated minutes saved per week (frequency × per-invocation) */
  perWeekMin: number;
  /** Confidence in the estimate */
  confidence: number;
}
