// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-002 LanceDB Adapter
// @gate G18-pro.3, G18-pro.4

import {
  EmbeddingRecordSchema,
  DimensionMismatchError, EmbeddingNotFoundError,
  type EmbeddingRecord, type VectorSearchHit, type VectorSearchOptions,
} from './contracts.js';

export interface VectorDriver {
  init(dim: number): Promise<void>;
  upsert(rec: EmbeddingRecord): Promise<void>;
  delete(id: string): Promise<boolean>;
  get(id: string): Promise<EmbeddingRecord | null>;
  search(query: Float32Array, opts: Required<Pick<VectorSearchOptions, 'k' | 'metric'>> & { scopeId?: string }): Promise<VectorSearchHit[]>;
  count(scopeId?: string): Promise<number>;
  close(): Promise<void>;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
function l2Distance(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i]! - b[i]!; s += d * d; }
  return Math.sqrt(s);
}
function dotProduct(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

export class InMemoryVectorDriver implements VectorDriver {
  private dim = 0;
  private records = new Map<string, EmbeddingRecord>();

  async init(dim: number): Promise<void> { this.dim = dim; }

  async upsert(rec: EmbeddingRecord): Promise<void> {
    if (rec.vector.length !== this.dim) {
      throw new DimensionMismatchError(this.dim, rec.vector.length);
    }
    EmbeddingRecordSchema.parse(rec);
    this.records.set(rec.id, rec);
  }

  async delete(id: string): Promise<boolean> { return this.records.delete(id); }
  async get(id: string): Promise<EmbeddingRecord | null> { return this.records.get(id) ?? null; }

  async search(query: Float32Array, opts: Required<Pick<VectorSearchOptions, 'k' | 'metric'>> & { scopeId?: string }): Promise<VectorSearchHit[]> {
    if (query.length !== this.dim) throw new DimensionMismatchError(this.dim, query.length);
    const all = [...this.records.values()];
    const filtered = opts.scopeId ? all.filter((r) => r.scopeId === opts.scopeId) : all;
    const scored = filtered.map((r) => {
      let score: number;
      switch (opts.metric) {
        case 'cosine': score = cosineSimilarity(query, r.vector); break;
        case 'l2':     score = -l2Distance(query, r.vector); break;
        case 'dot':    score = dotProduct(query, r.vector); break;
      }
      return {
        id: r.id, scopeId: r.scopeId, score,
        text: r.text, metadata: r.metadata,
      } as VectorSearchHit;
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, opts.k);
  }

  async count(scopeId?: string): Promise<number> {
    if (!scopeId) return this.records.size;
    let c = 0;
    for (const r of this.records.values()) if (r.scopeId === scopeId) c++;
    return c;
  }

  async close(): Promise<void> { this.records.clear(); }
}

export interface LanceDBAdapterOptions {
  dbPath: string;
  tableName?: string;
  dim: number;
  driver?: VectorDriver;
}

export class LanceDBEmbeddingAdapter {
  private readonly driver: VectorDriver;
  private readonly dim: number;

  constructor(opts: LanceDBAdapterOptions) {
    if (opts.dim <= 0 || opts.dim > 4096) throw new Error(`invalid dim: ${opts.dim}`);
    this.dim = opts.dim;
    this.driver = opts.driver ?? new InMemoryVectorDriver();
  }

  async init(): Promise<void> { await this.driver.init(this.dim); }
  async close(): Promise<void> { await this.driver.close(); }

  async upsert(rec: EmbeddingRecord): Promise<EmbeddingRecord> {
    await this.driver.upsert(rec);
    return rec;
  }

  async get(id: string): Promise<EmbeddingRecord> {
    const r = await this.driver.get(id);
    if (!r) throw new EmbeddingNotFoundError(id);
    return r;
  }

  async tryGet(id: string): Promise<EmbeddingRecord | null> { return this.driver.get(id); }

  async delete(id: string): Promise<boolean> { return this.driver.delete(id); }

  async search(query: Float32Array, opts: VectorSearchOptions = {}): Promise<VectorSearchHit[]> {
    return this.driver.search(query, {
      k: Math.min(opts.k ?? 10, 1000),
      metric: opts.metric ?? 'cosine',
      scopeId: opts.scopeId,
    });
  }

  async count(scopeId?: string): Promise<number> { return this.driver.count(scopeId); }
}
