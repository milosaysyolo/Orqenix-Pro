// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-003 Driver Interface
// @gate G18-pro.5

import type { CachedVerification } from './contracts.js';

export interface KvDriver {
  open(dbPath: string): Promise<void>;
  get(key: string): Promise<CachedVerification | null>;
  put(key: string, value: CachedVerification): Promise<void>;
  delete(key: string): Promise<boolean>;
  scan(prefix: string): Promise<Array<{ key: string; value: CachedVerification }>>;
  count(): Promise<number>;
  close(): Promise<void>;
}

export class InMemoryKvDriver implements KvDriver {
  private map = new Map<string, CachedVerification>();
  private opened = false;
  async open(_dbPath: string): Promise<void> { this.opened = true; }
  private check(): void { if (!this.opened) throw new Error('driver not opened'); }
  async get(key: string): Promise<CachedVerification | null> { this.check(); return this.map.get(key) ?? null; }
  async put(key: string, value: CachedVerification): Promise<void> { this.check(); this.map.set(key, value); }
  async delete(key: string): Promise<boolean> { this.check(); return this.map.delete(key); }
  async scan(prefix: string): Promise<Array<{ key: string; value: CachedVerification }>> {
    this.check();
    const out: Array<{ key: string; value: CachedVerification }> = [];
    for (const [k, v] of this.map.entries()) if (k.startsWith(prefix)) out.push({ key: k, value: v });
    return out;
  }
  async count(): Promise<number> { this.check(); return this.map.size; }
  async close(): Promise<void> { this.opened = false; this.map.clear(); }
}
