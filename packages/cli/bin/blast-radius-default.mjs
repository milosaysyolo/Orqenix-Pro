// bin/blast-radius-default.mjs
// In-memory BlastRadiusStore adapter matching the QuotaStore structural interface from subcommands.
// Swappable with the real @orqenix-pro/blast-radius BlastRadiusStore in a deployment wrapper.

import { QUOTA_KINDS } from '../dist/subcommands/quota-store.js';

const DEFAULT_WINDOW_MS = 60_000;

export class DefaultBlastRadiusStore {
  constructor() {
    this._quotas = new Map();
    for (const kind of QUOTA_KINDS) {
      this._quotas.set(kind, this._make(kind));
    }
  }
  _make(kind) {
    return {
      kind,
      scope: 'local',
      current: 0,
      limit: 1000,
      windowMs: DEFAULT_WINDOW_MS,
      windowRemainingMs: DEFAULT_WINDOW_MS,
      breached: false,
      windowStartedAtMs: Date.now(),
    };
  }
  async listQuotas(_scope) {
    return [...this._quotas.values()];
  }
  async getQuota(_scope, kind) {
    return this._quotas.get(kind);
  }
  async setLimit(_scope, kind, limit) {
    const e = this._quotas.get(kind);
    if (!e) throw new Error('unknown quota kind: ' + kind);
    const upd = { ...e, limit, breached: e.current >= limit };
    this._quotas.set(kind, upd);
    return upd;
  }
  async resetWindow(_scope, kind) {
    const e = this._quotas.get(kind);
    if (!e) throw new Error('unknown quota kind: ' + kind);
    const upd = { ...e, current: 0, windowRemainingMs: e.windowMs, windowStartedAtMs: Date.now() };
    this._quotas.set(kind, upd);
    return upd;
  }
}
