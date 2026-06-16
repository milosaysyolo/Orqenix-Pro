// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/self-learning-advanced , AB test store
//
// Persists A/B comparison results for review and historical reference. Pro feature.

import type { ABComparison } from './types';

export interface ABTestStoreOptions {
  /** In-memory store by default; swap for SQLite/JSON in production */
  storage?: Map<string, ABComparison>;
}

export class ABTestStore {
  private readonly storage: Map<string, ABComparison>;

  constructor(options: ABTestStoreOptions = {}) {
    this.storage = options.storage ?? new Map();
  }

  /** Saves an A/B comparison result keyed by variant pair hash */
  save(comparison: ABComparison): void {
    const key = this.key(comparison.variantAHash, comparison.variantBHash);
    this.storage.set(key, comparison);
  }

  /** Retrieves a comparison by variant pair */
  get(variantAHash: string, variantBHash: string): ABComparison | undefined {
    return this.storage.get(this.key(variantAHash, variantBHash));
  }

  /** Lists all stored comparisons */
  list(): ABComparison[] {
    return Array.from(this.storage.values());
  }

  private key(a: string, b: string): string {
    return [a, b].sort().join('::');
  }
}
