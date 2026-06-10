// bin/audit-log-default.mjs
// In-memory AuditLog implementation matching the structural interface from subcommands.
// Swappable with a production adapter linked to @orqenix/audit-log in a deployment wrapper.

export class DefaultAuditLog {
  constructor() {
    this._entries = [];
  }
  async append(input) {
    const prevHash = this._entries.length > 0 ? this._entries[this._entries.length - 1].hash : '0'.repeat(64);
    const entry = {
      index: this._entries.length,
      ts: Date.now(),
      type: input.type,
      actor: input.actor,
      subject: input.subject,
      details: input.details,
      hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      prevHash,
    };
    this._entries.push(entry);
    return entry;
  }
  async get(index) {
    return this._entries[index];
  }
}
