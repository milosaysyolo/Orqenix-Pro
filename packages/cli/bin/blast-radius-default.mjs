// packages/cli/bin/blast-radius-default.mjs
const DEFAULT_WINDOW = 60_000;

export class DefaultBlastRadiusStore {
  constructor(scope) {
    this.scope = scope;
    this.quotas = new Map();
    for (const kind of [
      'rpc_calls_per_min',
      'bytes_egress_per_hour',
      'delegations_active',
      'recall_queries_per_min',
      'distill_tokens_per_day',
    ]) {
      this.quotas.set(kind, {
        kind,
        scope,
        current: 0,
        limit: 100,
        windowMs: DEFAULT_WINDOW,
        windowRemainingMs: DEFAULT_WINDOW,
        breached: false,
        windowStartedAtMs: Date.now(),
      });
    }
  }

  async listQuotas() {
    return [...this.quotas.values()];
  }

  async getQuota(_scope, kind) {
    return this.quotas.get(kind);
  }

  async setLimit(_scope, kind, limit) {
    const q = this.quotas.get(kind);
    if (!q) return undefined;
    const next = { ...q, limit, breached: q.current >= limit };
    this.quotas.set(kind, next);
    return next;
  }

  async resetWindow(_scope, kind) {
    const q = this.quotas.get(kind);
    if (!q) return undefined;
    const next = {
      ...q,
      current: 0,
      breached: false,
      windowRemainingMs: q.windowMs,
      windowStartedAtMs: Date.now(),
    };
    this.quotas.set(kind, next);
    return next;
  }
}
