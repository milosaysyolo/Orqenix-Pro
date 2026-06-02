// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-003 Token Store
// @gate G18-pro.6, G18-pro.7

import {
  CachedVerificationSchema, TokenStoreClosedError,
  type CachedVerification, type TokenStoreStats,
} from './contracts.js';
import { InMemoryKvDriver, type KvDriver } from './driver.js';

const KEY_PREFIX = 'v:';

export interface TokenStoreOptions {
  dbPath: string;
  driver?: KvDriver;
  now?: () => string;
}

export class TokenStore {
  private readonly driver: KvDriver;
  private readonly dbPath: string;
  private readonly now: () => string;
  private opened = false;
  private hits = 0;
  private misses = 0;
  private writes = 0;
  private expirations = 0;

  constructor(opts: TokenStoreOptions) {
    this.driver = opts.driver ?? new InMemoryKvDriver();
    this.dbPath = opts.dbPath;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  async open(): Promise<void> {
    await this.driver.open(this.dbPath);
    this.opened = true;
  }

  private ensureOpen(): void { if (!this.opened) throw new TokenStoreClosedError(); }

  private isExpired(v: CachedVerification): boolean {
    return new Date(v.expiresAt).getTime() <= new Date(this.now()).getTime();
  }

  async get(jti: string): Promise<CachedVerification | null> {
    this.ensureOpen();
    const v = await this.driver.get(KEY_PREFIX + jti);
    if (!v) { this.misses++; return null; }
    if (this.isExpired(v)) {
      await this.driver.delete(KEY_PREFIX + jti);
      this.expirations++;
      this.misses++;
      return null;
    }
    this.hits++;
    return v;
  }

  async put(verification: CachedVerification): Promise<void> {
    this.ensureOpen();
    CachedVerificationSchema.parse(verification);
    await this.driver.put(KEY_PREFIX + verification.jti, verification);
    this.writes++;
  }

  async invalidate(jti: string): Promise<boolean> {
    this.ensureOpen();
    return this.driver.delete(KEY_PREFIX + jti);
  }

  async invalidateScope(scopeId: string): Promise<number> {
    this.ensureOpen();
    const all = await this.driver.scan(KEY_PREFIX);
    let count = 0;
    for (const { key, value } of all) {
      if (value.scopeId === scopeId) {
        if (await this.driver.delete(key)) count++;
      }
    }
    return count;
  }

  async compact(): Promise<number> {
    this.ensureOpen();
    const all = await this.driver.scan(KEY_PREFIX);
    let removed = 0;
    for (const { key, value } of all) {
      if (this.isExpired(value)) {
        if (await this.driver.delete(key)) { removed++; this.expirations++; }
      }
    }
    return removed;
  }

  async size(): Promise<number> {
    this.ensureOpen();
    return this.driver.count();
  }

  async stats(): Promise<TokenStoreStats> {
    this.ensureOpen();
    return {
      hits: this.hits, misses: this.misses,
      writes: this.writes, expirations: this.expirations,
      size: await this.driver.count(),
    };
  }

  async close(): Promise<void> {
    if (!this.opened) return;
    await this.driver.close();
    this.opened = false;
  }
}
