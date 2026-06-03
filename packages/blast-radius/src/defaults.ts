// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-007 Default Quotas
// @gate G37-pro

import type { QuotaKind } from './contracts.js';

export interface DefaultQuotaConfig {
  kind: QuotaKind;
  limit: number;
  windowMs: number;
}

// Sensible defaults from CR v7.1 Ch.16 (operational safety stance).
// Callers should tune these per environment.
export const DEFAULT_QUOTAS: readonly DefaultQuotaConfig[] = Object.freeze([
  { kind: 'writes_per_hour',              limit: 5_000,         windowMs: 3_600_000        },
  { kind: 'writes_per_day',               limit: 50_000,        windowMs: 86_400_000       },
  { kind: 'cross_scope_writes_per_hour',  limit: 1_000,         windowMs: 3_600_000        },
  { kind: 'detach_per_day',               limit: 10,            windowMs: 86_400_000       },
  { kind: 'kb_bytes_per_day',             limit: 100 * 1_048_576, windowMs: 86_400_000     },
]);

export function applyDefaultQuotas(setQuota: (input: DefaultQuotaConfig) => void): void {
  for (const q of DEFAULT_QUOTAS) setQuota(q);
}
