// SPDX-License-Identifier: BUSL-1.1
// Shared test fixtures for OSS↔Pro interop suite.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { CHAT_KB_MIGRATIONS, ChatStore } from '@orqenix/kb-chat';
import { MEMORY_TIER_MIGRATIONS, MemoryTierStore } from '@orqenix/memory-tiers';
import { SCOPE_LINK_MIGRATIONS, ScopeLinkStore } from '@orqenix/scope-link';
import { WORKSPACE_MIGRATIONS, WorkspaceStore } from '@orqenix/workspace';
import { AUDIT_LOG_MIGRATIONS, AuditLogStore } from '@orqenix/audit-log';
import { BLAST_RADIUS_MIGRATIONS, BlastRadiusStore } from '@orqenix-pro/blast-radius';
import type { LlmAdapter, LlmRequest, LlmResponse } from '@orqenix/llm-adapter-ollama';

export const SCOPE_A = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const SCOPE_B = 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
export const SCOPE_C = 'scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
export const TOK_AB = 'tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
export const TOK_BC = 'tok:EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';

export interface UnifiedKB {
  dir: string;
  conn: SqliteConnection;
  chat: ChatStore;
  memStore: MemoryTierStore;
  linkStore: ScopeLinkStore;
  workspaceStore: WorkspaceStore;
  auditStore: AuditLogStore;
  blastRadius: BlastRadiusStore;
  scopeId: string;
}

export async function makeUnifiedKB(scopeId: string = SCOPE_A): Promise<UnifiedKB> {
  const dir = await mkdtemp(join(tmpdir(), 'oss-pro-interop-'));
  const conn = new SqliteConnection({ path: join(dir, 'kb.sqlite') });
  runMigrations(conn, [
    ...CHAT_KB_MIGRATIONS,
    ...MEMORY_TIER_MIGRATIONS,
    ...SCOPE_LINK_MIGRATIONS,
    ...WORKSPACE_MIGRATIONS,
    ...AUDIT_LOG_MIGRATIONS,
    ...BLAST_RADIUS_MIGRATIONS,
  ]);
  return {
    dir, conn,
    chat: new ChatStore({ conn, scopeId }),
    memStore: new MemoryTierStore({ conn, scopeId }),
    linkStore: new ScopeLinkStore({ conn, localScopeId: scopeId }),
    workspaceStore: new WorkspaceStore({ conn }),
    auditStore: new AuditLogStore({ conn, scopeId }),
    blastRadius: new BlastRadiusStore({ conn, scopeId }),
    scopeId,
  };
}

export async function teardownKB(kb: UnifiedKB): Promise<void> {
  kb.conn.close();
  await new Promise((r) => setTimeout(r, 50));
  await rm(kb.dir, { recursive: true, force: true, maxRetries: 3 });
}

export function makeScriptedAdapter(responses: Array<string | (() => string)>): LlmAdapter & { callCount: () => number } {
  let i = 0;
  let calls = 0;
  return {
    provider: 'scripted-mock', model: 'mock-1',
    async complete(_req: LlmRequest): Promise<LlmResponse> {
      calls++;
      const r = responses[i++ % responses.length];
      const content = typeof r === 'function' ? r() : r;
      return {
        content, finishReason: 'stop',
        tokensIn: Math.max(1, Math.ceil(content.length / 4)),
        tokensOut: Math.max(1, Math.ceil(content.length / 4)),
        model: 'mock-1', provider: 'scripted-mock', latencyMs: 1,
      };
    },
    async isHealthy() { return true; },
    callCount: () => calls,
  };
}
