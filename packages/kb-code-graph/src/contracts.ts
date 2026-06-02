// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-001 KB Code Graph Contracts
// @gate G18-pro

import { z } from 'zod';
import { OrqenixError, type Brand } from '@orqenix/core';

export type SymbolId = Brand<string, 'SymbolId'>;
export type EdgeId = Brand<string, 'EdgeId'>;

export const SYMBOL_KINDS = ['function', 'class', 'method', 'type', 'variable', 'module'] as const;
export type SymbolKind = (typeof SYMBOL_KINDS)[number];

export const EDGE_KINDS = ['calls', 'imports', 'extends', 'implements', 'references', 'declares'] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const CodeSymbolSchema = z.object({
  symbolId: z.string().min(1).max(128),
  scopeId: z.string().min(1),
  kind: z.enum(SYMBOL_KINDS),
  name: z.string().min(1).max(256),
  filePath: z.string().min(1).max(2048),
  lineStart: z.number().int().nonnegative(),
  lineEnd: z.number().int().nonnegative(),
  signature: z.string().max(2048).optional(),
  docstring: z.string().max(4096).optional(),
  createdAt: z.string(),
}).strict().refine((s) => s.lineEnd >= s.lineStart, { message: 'lineEnd must be >= lineStart' });
export type CodeSymbol = z.infer<typeof CodeSymbolSchema>;

export const CodeEdgeSchema = z.object({
  edgeId: z.string().min(1).max(128),
  scopeId: z.string().min(1),
  sourceSymbolId: z.string().min(1).max(128),
  targetSymbolId: z.string().min(1).max(128),
  kind: z.enum(EDGE_KINDS),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string(),
}).strict();
export type CodeEdge = z.infer<typeof CodeEdgeSchema>;

export class SymbolNotFoundError extends OrqenixError {
  constructor(id: string) { super(`code symbol not found: ${id}`, 'SYMBOL_NOT_FOUND'); }
}
export class EdgeNotFoundError extends OrqenixError {
  constructor(id: string) { super(`code edge not found: ${id}`, 'EDGE_NOT_FOUND'); }
}
export class GraphIntegrityError extends OrqenixError {
  constructor(reason: string) { super(`graph integrity violation: ${reason}`, 'GRAPH_INTEGRITY'); }
}
