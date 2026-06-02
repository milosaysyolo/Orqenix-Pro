// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-002 Embedding Lance Contracts
// @gate G18-pro

import { z } from 'zod';
import { OrqenixError, type Brand } from '@orqenix/core';

export type EmbeddingId = Brand<string, 'EmbeddingId'>;

export const EmbeddingRecordSchema = z.object({
  id: z.string().min(1).max(128),
  scopeId: z.string().min(1),
  vector: z.instanceof(Float32Array),
  text: z.string().max(64 * 1024).optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string(),
}).strict();
export type EmbeddingRecord = z.infer<typeof EmbeddingRecordSchema>;

export interface VectorSearchHit {
  id: string;
  scopeId: string;
  score: number;
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface VectorSearchOptions {
  k?: number;
  scopeId?: string;
  metric?: 'cosine' | 'l2' | 'dot';
}

export class DimensionMismatchError extends OrqenixError {
  constructor(expected: number, actual: number) {
    super(`embedding dimension mismatch: expected ${expected}, got ${actual}`, 'DIM_MISMATCH');
  }
}
export class EmbeddingNotFoundError extends OrqenixError {
  constructor(id: string) { super(`embedding not found: ${id}`, 'EMBEDDING_NOT_FOUND'); }
}
