// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import { AdvancedDetector } from '../src/advanced-detector';
import { SemanticClusterer } from '../src/semantic-clusterer';
import { TemplateExtractor } from '../src/template-extractor';
import { ABComparator } from '../src/ab-comparator';
import { SELF_LEARNING_MIGRATIONS } from '@orqenix/self-learning-observer';
import type { DetectedPattern } from '@orqenix/self-learning-detection';
import type { ObservationEvent } from '@orqenix/self-learning-observer';

function setupDb(): DB {
  const db = new Database(':memory:');
  for (const m of SELF_LEARNING_MIGRATIONS) db.exec(m.up);
  return db;
}

function pattern(hash: string, kinds: string[], occ: number, rate: number): DetectedPattern {
  return {
    patternHash: hash,
    actionKinds: kinds,
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

describe('AdvancedDetector (IDetector drop-in)', () => {
  let db: DB;

  beforeEach(() => { db = setupDb(); });
  afterEach(() => db.close());

  it('implements IDetector (has detect)', () => {
    const detector = new AdvancedDetector({ db });
    expect(typeof detector.detect).toBe('function');
  });

  it('detect returns patterns (delegates to basic + enriches)', async () => {
    const detector = new AdvancedDetector({ db });
    const events: ObservationEvent[] = [];
    const result = await detector.detect({ projectId: 'p', events });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('SemanticClusterer', () => {
  it('clusters similar sequences', () => {
    const clusterer = new SemanticClusterer(0.5);
    const patterns = [
      pattern('p1', ['edit', 'test', 'commit'], 10, 1.0),
      pattern('p2', ['edit', 'test', 'push'], 8, 0.9), // similar to p1
      pattern('p3', ['deploy', 'monitor'], 5, 1.0), // distinct
    ];
    const clusters = clusterer.cluster(patterns);
    // p1 + p2 should cluster; p3 separate
    expect(clusters.length).toBeLessThanOrEqual(3);
    const bigCluster = clusters.find((c) => c.memberHashes.length > 1);
    expect(bigCluster).toBeDefined();
  });

  it('representative is highest impact', () => {
    const clusterer = new SemanticClusterer(0.5);
    const patterns = [
      { ...pattern('low', ['a', 'b'], 5, 1.0), impactScore: 3 },
      { ...pattern('high', ['a', 'b'], 20, 1.0), impactScore: 9 },
    ];
    const clusters = clusterer.cluster(patterns);
    expect(clusters[0]?.representative.patternHash).toBe('high');
  });
});

describe('TemplateExtractor', () => {
  it('parameterizes varying command segments', () => {
    const extractor = new TemplateExtractor();
    const events = [
      { action_payload: { command: 'git commit -m a' } },
      { action_payload: { command: 'git commit -m b' } },
    ] as ObservationEvent[];
    const templates = extractor.extract(events);
    expect(templates.length).toBeGreaterThanOrEqual(1);
    expect(templates[0]?.parameters.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ABComparator', () => {
  it('declares winner when success rates differ significantly', () => {
    const comparator = new ABComparator();
    const a = pattern('a', ['x'], 50, 0.95);
    const b = pattern('b', ['x'], 50, 0.50);
    const result = comparator.compare(a, b);
    expect(result.winner).toBe('a');
  });

  it('declares tie when rates close', () => {
    const comparator = new ABComparator();
    const a = pattern('a', ['x'], 50, 0.80);
    const b = pattern('b', ['x'], 50, 0.81);
    const result = comparator.compare(a, b);
    expect(result.winner).toBe('tie');
  });
});
