import type { ScopeId } from '@orqenix/mesh-transport-core';

export interface Delegation {
  jti: string;
  issuer: ScopeId;
  subject: ScopeId;
  caps: string[];
  expiresAtMs: number;
  parentJti?: string;
  revoked: boolean;
  revokedReason?: string;
  createdAtMs: number;
}

export interface DelegationStore {
  listForScope(scopeId: ScopeId, opts?: { includeRevoked?: boolean }): Promise<Delegation[]>;
  get(jti: string): Promise<Delegation | undefined>;
  chain(jti: string, maxDepth?: number): Promise<Delegation[]>;
  revoke(jti: string, reason: string): Promise<Delegation>;
}

export interface AuditEntry {
  index: number;
  ts: number;
  type: string;
  actor: ScopeId;
  subject: string;
  details: Record<string, unknown>;
  hash: string;
  prevHash: string;
}

export interface AuditLog {
  append(input: { type: string; actor: ScopeId; subject: string; details: Record<string, unknown> }): Promise<AuditEntry>;
  get(index: number): Promise<AuditEntry | undefined>;
}
