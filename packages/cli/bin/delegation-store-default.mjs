// bin/delegation-store-default.mjs
// In-memory DelegationStore implementation matching the structural interface from subcommands.
// Swappable with a production adapter linked to @orqenix-pro/mesh-delegation in a deployment wrapper.

export class DefaultDelegationStore {
  constructor() {
    this._delegations = new Map();
  }
  async listForScope(_scopeId, _opts) {
    return [...this._delegations.values()];
  }
  async get(jti) {
    return this._delegations.get(jti);
  }
  async chain(_jti, _maxDepth) {
    return [];
  }
  async revoke(jti, reason) {
    const d = this._delegations.get(jti);
    if (!d) throw Object.assign(new Error('delegation not found'), { code: 4 });
    const upd = { ...d, revoked: true, revokedReason: reason };
    this._delegations.set(jti, upd);
    return upd;
  }
}
