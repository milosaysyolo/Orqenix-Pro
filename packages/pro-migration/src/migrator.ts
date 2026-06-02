// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-004 Pro Backend Migrator
// @gate G18-pro.8, G18-pro.9

import type { KuzuGraphAdapter, CodeSymbol, CodeEdge } from '@orqenix-pro/kb-code-graph';
import type { LanceDBEmbeddingAdapter, EmbeddingRecord } from '@orqenix-pro/kb-embedding-lance';
import type { TokenStore, CachedVerification } from '@orqenix-pro/kb-token-store';
import {
  ProMigrationReportSchema, ProMigrationVerificationError,
  type ProMigrationReport,
} from './contracts.js';

function nowIso(): string { return new Date().toISOString(); }

export interface MigrateCodeGraphInput {
  symbols: CodeSymbol[];
  edges: CodeEdge[];
  target: KuzuGraphAdapter;
  scopeId: string;
}

export async function migrateCodeGraph(input: MigrateCodeGraphInput): Promise<ProMigrationReport> {
  const startedAt = nowIso();
  const start = Date.now();
  let items = 0;

  for (const s of input.symbols) {
    await input.target.addSymbol(s);
    items++;
  }
  for (const e of input.edges) {
    await input.target.addEdge(e);
    items++;
  }

  const symCount = await input.target.countSymbols(input.scopeId);
  const edgeCount = await input.target.countEdges(input.scopeId);
  const expected = input.symbols.length + input.edges.length;
  const actual = symCount + edgeCount;
  if (actual !== expected) throw new ProMigrationVerificationError('kb-code-graph', expected, actual);

  const finishedAt = nowIso();
  return ProMigrationReportSchema.parse({
    backend: 'kb-code-graph',
    source: 'array', target: 'kuzu',
    itemsMigrated: items, itemsVerified: actual,
    durationMs: Date.now() - start,
    startedAt, finishedAt,
  });
}

export interface MigrateEmbeddingsInput {
  sourceItems: EmbeddingRecord[];
  target: LanceDBEmbeddingAdapter;
  scopeId: string;
  batchSize?: number;
}

export async function migrateEmbeddings(input: MigrateEmbeddingsInput): Promise<ProMigrationReport> {
  const startedAt = nowIso();
  const start = Date.now();
  const batchSize = input.batchSize ?? 100;
  let items = 0;

  for (let i = 0; i < input.sourceItems.length; i += batchSize) {
    const batch = input.sourceItems.slice(i, i + batchSize);
    for (const rec of batch) {
      await input.target.upsert(rec);
      items++;
    }
  }

  const actual = await input.target.count(input.scopeId);
  const expected = input.sourceItems.filter((r) => r.scopeId === input.scopeId).length;
  if (actual !== expected) throw new ProMigrationVerificationError('kb-embedding', expected, actual);

  const finishedAt = nowIso();
  return ProMigrationReportSchema.parse({
    backend: 'kb-embedding',
    source: 'array', target: 'lancedb',
    itemsMigrated: items, itemsVerified: actual,
    durationMs: Date.now() - start,
    startedAt, finishedAt,
  });
}

export interface MigrateTokenStoreInput {
  sourceItems: CachedVerification[];
  target: TokenStore;
  now?: () => string;
}

export async function migrateTokenStore(input: MigrateTokenStoreInput): Promise<ProMigrationReport> {
  const startedAt = nowIso();
  const start = Date.now();
  const now = input.now ?? (() => nowIso());
  const tNow = new Date(now()).getTime();
  let items = 0;

  const validItems = input.sourceItems.filter((v) => new Date(v.expiresAt).getTime() > tNow);
  for (const v of validItems) {
    await input.target.put(v);
    items++;
  }

  const actual = await input.target.size();
  if (actual !== validItems.length) {
    throw new ProMigrationVerificationError('kb-token-store', validItems.length, actual);
  }

  const finishedAt = nowIso();
  return ProMigrationReportSchema.parse({
    backend: 'kb-token-store',
    source: 'array', target: 'lmdb',
    itemsMigrated: items, itemsVerified: actual,
    durationMs: Date.now() - start,
    startedAt, finishedAt,
  });
}
