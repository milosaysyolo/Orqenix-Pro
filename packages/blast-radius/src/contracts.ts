// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-007 Blast Radius Contracts
// @gate G37-pro

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';
import { SCOPE_ID_PATTERN } from '@orqenix/scope-identity';

export const QUOTA_KINDS = [
  'writes_per_hour',
  'writes_per_day',
  'cross_scope_writes_per_hour',
  'detach_per_day',
  'kb_bytes_per_day',
] as const;
export type QuotaKind = (typeof QUOTA_KINDS)[number];

export const BlastRadiusQuotaSchema = z.object({
  scopeId: z.string().regex(SCOPE_ID_PATTERN),
  kind: z.enum(QUOTA_KINDS),
  limit: z.number().int().positive().max(1_000_000_000),
  windowMs: z.number().int().min(1000).max(7 * 24 * 3600 * 1000),
  createdAt: z.string(),
}).strict();
export type BlastRadiusQuota = z.infer<typeof BlastRadiusQuotaSchema>;

export interface QuotaConsumption {
  scopeId: string;
  kind: QuotaKind;
  consumed: number;
  limit: number;
  windowMs: number;
  windowStartedAt: string;
}

export class QuotaExceededError extends OrqenixError {
  constructor(public readonly kind: QuotaKind, public readonly limit: number, public readonly attempted: number) {
    super(`quota ${kind} exceeded: attempted ${attempted}, limit ${limit}`, 'QUOTA_EXCEEDED');
  }
}
export class QuotaNotConfiguredError extends OrqenixError {
  constructor(scopeId: string, kind: QuotaKind) {
    super(`no quota configured for scope ${scopeId} kind ${kind}`, 'QUOTA_NOT_CONFIGURED');
  }
}
