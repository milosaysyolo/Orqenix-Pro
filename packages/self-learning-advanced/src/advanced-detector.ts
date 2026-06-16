// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/self-learning-advanced , Advanced Detector
//
// IDetector drop-in replacement that adds template extraction + semantic
// clustering + accurate time-savings on top of basic detection.

import type { Database } from 'better-sqlite3';
import {
  BasicDetector,
  type IDetector,
  type DetectionInput,
  type DetectedPattern,
} from '@orqenix/self-learning-detection';
import { TemplateExtractor } from './template-extractor';
import { SemanticClusterer } from './semantic-clusterer';
import { TimeSavingsEstimator } from './time-savings-estimator';

export interface AdvancedDetectorOptions {
  db: Database;
  /** Semantic similarity threshold for clustering (default 0.7) */
  similarityThreshold?: number;
}

/**
 * AdvancedDetector implements IDetector (same contract as BasicDetector).
 *
 * Pipeline: basic detection → semantic clustering (fold similar patterns) →
 * accurate time-savings re-scoring. Cross-format aware via template extraction.
 */
export class AdvancedDetector implements IDetector {
  private readonly basic: BasicDetector;
  private readonly clusterer: SemanticClusterer;
  private readonly timeSavings: TimeSavingsEstimator;
  private readonly templateExtractor: TemplateExtractor;

  constructor(options: AdvancedDetectorOptions) {
    this.basic = new BasicDetector({ db: options.db });
    this.clusterer = new SemanticClusterer(options.similarityThreshold ?? 0.7);
    this.timeSavings = new TimeSavingsEstimator();
    this.templateExtractor = new TemplateExtractor();
  }

  /**
   * Detects patterns with advanced clustering + accurate impact scoring.
   */
  async detect(input: DetectionInput): Promise<DetectedPattern[]> {
    // 1. Basic detection
    const basicPatterns = await this.basic.detect(input);

    // 2. Semantic clustering (fold similar but not identical patterns)
    const clusters = this.clusterer.cluster(basicPatterns);

    // 3. Re-score representatives with accurate time-savings
    const enriched: DetectedPattern[] = clusters.map((cluster) => {
      const rep = cluster.representative;
      const estimate = this.timeSavings.estimate(rep, input.events);
      // Recompute impact with accurate time savings
      const freqFactor = Math.log10(rep.occurrenceCount + 1);
      const accurateImpact = Math.min(
        10,
        freqFactor * rep.successRate * (1 + estimate.perWeekMin / 60) * 2
      );
      return {
        ...rep,
        // Fold member count into occurrence (cluster captures more occurrences)
        occurrenceCount: rep.occurrenceCount + (cluster.memberHashes.length - 1),
        impactScore: accurateImpact,
      };
    });

    return enriched.sort((a, b) => b.impactScore - a.impactScore);
  }

  /** Exposes template extraction for the Workbench (Pro UI feature) */
  extractTemplates(input: DetectionInput): ReturnType<TemplateExtractor['extract']> {
    return this.templateExtractor.extract(input.events);
  }
}
