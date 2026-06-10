// packages/cli/bin/delegation-store-default.mjs
export class DefaultDelegationStore {
  constructor(seed = []) {
    this.items = new Map(seed.map((d) => [d.jti, { ...d }]));
  }

  async listForScope(scope) {
    return [...this.items.values()].filter((d) => d.subject === scope || d.issuer === scope);
  }

  async get(jti) {
    return this.items.get(jti);
  }

  async chain(jti) {
    const out = [];
    let cur = this.items.get(jti);
    while (cur) {
      out.push(cur);
      if (!cur.parentJti) break;
      cur = this.items.get(cur.parentJti);
    }
    return out;
  }

  async revoke(jti, reason) {
    const cur = this.items.get(jti);
    if (!cur) return undefined;
    const next = { ...cur, revoked: true, revokedReason: reason };
    this.items.set(jti, next);
    return next;
  }
}
