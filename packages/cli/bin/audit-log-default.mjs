// packages/cli/bin/audit-log-default.mjs
import { createHash } from 'node:crypto';

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function hashEntry(input, prevHash, index, ts) {
  return createHash('sha256')
    .update(stableJson({ index, ts, prevHash, ...input }))
    .digest('hex');
}

export class DefaultAuditLog {
  constructor() {
    this.entries = [];
  }

  async append(input) {
    const index = this.entries.length;
    const ts = Date.now();
    const prevHash = this.entries.at(-1)?.hash ?? '0'.repeat(64);
    const hash = hashEntry(input, prevHash, index, ts);
    const entry = {
      index,
      ts,
      type: input.type,
      actor: input.actor,
      subject: input.subject,
      details: input.details ?? {},
      prevHash,
      hash,
    };
    this.entries.push(entry);
    return entry;
  }

  async get(index) {
    return this.entries[index];
  }
}
