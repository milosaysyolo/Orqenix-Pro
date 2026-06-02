// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-007 Blast Radius Store
// @gate G37-pro.2, G37-pro.3, G37-pro.4

import type { SqliteConnection } from '@orqenix/storage-sqlite';
import type { AuditLogStore } from '@orqenix/audit-log';
import {
  BlastRadiusQuotaSchema,
  QuotaExceededError, QuotaNotConfiguredError,
  type BlastRadiusQuota, type QuotaConsumption, type QuotaKind,
} from './contracts.js';

interface QuotaRow {
  scope_id: string;
  kind: QuotaKind;
  limit_value: number;
  window_ms: number;
  created_at: string;
}

function toQuota(r: QuotaRow): BlastRadiusQuota {
  return {
    scopeId: r.scope_id, kind: r.kind,
    limit: r.limit_value, windowMs: r.window_ms,
    createdAt: r.created_at,
  };
}

function windowStartFor(now: number, windowMs: number): string {
  const bucket = Math.floor(now / windowMs) * windowMs;
  return new Date(bucket).toISOString();
}

export interface BlastRadiusStoreOptions {
  conn: SqliteConnection;
  scopeId: string;
  auditStore?: AuditLogStore;
  now?: () => string;
}

export interface SetQuotaInput {
  kind: QuotaKind;
  limit: number;
  windowMs: number;
}

export class BlastRadiusStore {
  private readonly conn: SqliteConnection;
  private readonly scopeId: string;
  private readonly auditStore?: AuditLogStore;
  private readonly now: () => string;

  constructor(opts: BlastRadiusStoreOptions) {
    this.conn = opts.conn;
    this.scopeId = opts.scopeId;
    this.auditStore = opts.auditStore;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  setQuota(input: SetQuotaInput): BlastRadiusQuota {
    const quota = BlastRadiusQuotaSchema.parse({
      scopeId: this.scopeId,
      kind: input.kind,
      limit: input.limit,
      windowMs: input.windowMs,
      createdAt: this.now(),
    });
    this.conn.prepare(
      `INSERT INTO blast_radius_quotas (scope_id, kind, limit_value, window_ms, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(scope_id, kind) DO UPDATE SET
         limit_value = excluded.limit_value,
         window_ms = excluded.window_ms,
         created_at = excluded.created_at`,
    ).run(quota.scopeId, quota.kind, quota.limit, quota.windowMs, quota.createdAt);
    return quota;
  }

  getQuota(kind: QuotaKind): BlastRadiusQuota | null {
    const row = this.conn.prepare<QuotaRow>(
      `SELECT * FROM blast_radius_quotas WHERE scope_id = ? AND kind = ?`,
    ).get(this.scopeId, kind) as QuotaRow | undefined;
    return row ? toQuota(row) : null;
  }

  listQuotas(): BlastRadiusQuota[] {
    const rows = this.conn.prepare<QuotaRow>(
      `SELECT * FROM blast_radius_quotas WHERE scope_id = ? ORDER BY kind ASC`,
    ).all(this.scopeId) as QuotaRow[];
    return rows.map(toQuota);
  }

  removeQuota(kind: QuotaKind): boolean {
    const r = this.conn.prepare(
      `DELETE FROM blast_radius_quotas WHERE scope_id = ? AND kind = ?`,
    ).run(this.scopeId, kind);
    return r.changes > 0;
  }

  usage(kind: QuotaKind): QuotaConsumption | null {
    const quota = this.getQuota(kind);
    if (!quota) return null;
    const nowMs = new Date(this.now()).getTime();
    const windowStart = windowStartFor(nowMs, quota.windowMs);
    const row = this.conn.prepare<{ consumed: number }>(
      `SELECT consumed FROM blast_radius_usage WHERE scope_id = ? AND kind = ? AND window_start = ?`,
    ).get(this.scopeId, kind, windowStart) as { consumed: number } | undefined;
    return {
      scopeId: this.scopeId, kind,
      consumed: row?.consumed ?? 0,
      limit: quota.limit,
      windowMs: quota.windowMs,
      windowStartedAt: windowStart,
    };
  }

  consume(kind: QuotaKind, amount = 1): QuotaConsumption {
    const quota = this.getQuota(kind);
    if (!quota) throw new QuotaNotConfiguredError(this.scopeId, kind);

    const nowMs = new Date(this.now()).getTime();
    const windowStart = windowStartFor(nowMs, quota.windowMs);

    let row = this.conn.prepare<{ consumed: number }>(
      `SELECT consumed FROM blast_radius_usage WHERE scope_id = ? AND kind = ? AND window_start = ?`,
    ).get(this.scopeId, kind, windowStart) as { consumed: number } | undefined;
    const currentConsumed = row?.consumed ?? 0;
    const next = currentConsumed + amount;
    if (next > quota.limit) {
      throw new QuotaExceededError(kind, quota.limit, next);
    }

    this.conn.prepare(
      `INSERT INTO blast_radius_usage (scope_id, kind, window_start, consumed)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(scope_id, kind, window_start) DO UPDATE SET
         consumed = consumed + excluded.consumed`,
    ).run(this.scopeId, kind, windowStart, amount);

    return {
      scopeId: this.scopeId, kind,
      consumed: next, limit: quota.limit,
      windowMs: quota.windowMs, windowStartedAt: windowStart,
    };
  }

  resetWindow(kind: QuotaKind): number {
    const quota = this.getQuota(kind);
    if (!quota) return 0;
    const nowMs = new Date(this.now()).getTime();
    const windowStart = windowStartFor(nowMs, quota.windowMs);
    const r = this.conn.prepare(
      `DELETE FROM blast_radius_usage WHERE scope_id = ? AND kind = ? AND window_start = ?`,
    ).run(this.scopeId, kind, windowStart);
    if (r.changes > 0 && this.auditStore) {
      try {
        this.auditStore.append({
          actorScopeId: this.scopeId,
          eventKind: 'kb_write', // closest reusable kind in OSS audit log
          payload: { brAction: 'reset_window', kind, windowStart },
        });
      } catch { /* swallow */ }
    }
    return r.changes;
  }
}
