import type { ScopeId } from '@orqenix/mesh-transport-core';

export const QUOTA_KINDS = [
  'rpc_calls_per_min',
  'bytes_egress_per_hour',
  'delegations_active',
  'recall_queries_per_min',
  'distill_tokens_per_day',
] as const;

export type QuotaKind = (typeof QUOTA_KINDS)[number];

export function isQuotaKind(s: string): s is QuotaKind {
  return (QUOTA_KINDS as readonly string[]).includes(s);
}

export interface Quota {
  kind: QuotaKind;
  scope: ScopeId;
  current: number;
  limit: number;
  windowMs: number;
  windowRemainingMs: number;
  breached: boolean;
  windowStartedAtMs: number;
}

export interface QuotaStore {
  listQuotas(scope: ScopeId): Promise<Quota[]>;
  getQuota(scope: ScopeId, kind: QuotaKind): Promise<Quota | undefined>;
  setLimit(scope: ScopeId, kind: QuotaKind, limit: number): Promise<Quota>;
  resetWindow(scope: ScopeId, kind: QuotaKind): Promise<Quota>;
}
