// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-004 Pro Migration Contracts
// @gate G18-pro

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';

export const BACKEND_KINDS = ['kb-code-graph', 'kb-embedding', 'kb-token-store'] as const;
export type BackendKind = (typeof BACKEND_KINDS)[number];

export const ProMigrationReportSchema = z.object({
  backend: z.enum(BACKEND_KINDS),
  source: z.string(),
  target: z.string(),
  itemsMigrated: z.number().int().nonnegative(),
  itemsVerified: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  startedAt: z.string(),
  finishedAt: z.string(),
}).strict();
export type ProMigrationReport = z.infer<typeof ProMigrationReportSchema>;

export class ProMigrationError extends OrqenixError {
  constructor(reason: string) { super(`pro migration error: ${reason}`, 'PRO_MIGRATION'); }
}
export class ProMigrationVerificationError extends OrqenixError {
  constructor(backend: string, expected: number, actual: number) {
    super(`verification failed for ${backend}: expected ${expected} items, found ${actual}`, 'PRO_MIGRATION_VERIFY');
  }
}
