// SPDX-License-Identifier: BUSL-1.1
// @gate G6-pro
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { ChatStore, CHAT_KB_MIGRATIONS } from '@orqenix/kb-chat';
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from '@orqenix/memory-tiers';
import type { LlmAdapter, LlmRequest, LlmResponse } from '@orqenix/llm-adapter-ollama';
import {
  LlmDistiller, parseLlmResponse, parseVerificationVerdict,
  mapProToOssMemoryType, isProOnlyType, PRO_MEMORY_TYPES,
  InvalidLlmResponseError,
} from '@orqenix-pro/memory-distiller-llm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const REPORT_DIR = join(REPO_ROOT, '.orqenix-pro/gate-reports');
const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

interface GateCheckResult {
  id: string; description: string; status: 'pass' | 'fail';
  durationMs: number; error?: { message: string };
}

async function check(id: string, description: string, fn: () => Promise<void> | void): Promise<GateCheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { id, description, status: 'pass', durationMs: Date.now() - start };
  } catch (e) {
    return { id, description, status: 'fail', durationMs: Date.now() - start, error: { message: (e as Error).message } };
  }
}

function mockAdapter(responses: string[]): LlmAdapter {
  let i = 0;
  return {
    provider: 'mock', model: 'mock-1',
    async complete(_req: LlmRequest): Promise<LlmResponse> {
      const content = responses[i++ % responses.length] ?? '[]';
      return { content, finishReason: 'stop', tokensIn: 50, tokensOut: 25, model: 'mock-1', provider: 'mock', latencyMs: 1 };
    },
    async isHealthy() { return true; },
  };
}

async function freshKb(): Promise<{ dir: string; conn: SqliteConnection; chat: ChatStore; memStore: MemoryTierStore }> {
  const dir = await mkdtemp(join(tmpdir(), 'g6-pro-'));
  const conn = new SqliteConnection({ path: join(dir, 'd.sqlite') });
  runMigrations(conn, [...CHAT_KB_MIGRATIONS, ...MEMORY_TIER_MIGRATIONS]);
  const chat = new ChatStore({ conn, scopeId: SCOPE });
  const memStore = new MemoryTierStore({ conn, scopeId: SCOPE });
  return { dir, conn, chat, memStore };
}

async function tear(dir: string, conn: SqliteConnection) {
  conn.close(); await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

async function runChecks(): Promise<GateCheckResult[]> {
  return [
    await check('G6-pro.1', 'memory-distiller-llm unit tests pass', () => {
      execSync('pnpm vitest run', { cwd: join(REPO_ROOT, 'packages/memory-distiller-llm'), stdio: 'pipe' });
    }),
    await check('G6-pro.2', '13 Pro memory types registered', () => {
      if (PRO_MEMORY_TYPES.length !== 13) throw new Error(`expected 13 types, got ${PRO_MEMORY_TYPES.length}`);
      const required = ['decision_rationale', 'code_pattern', 'anti_pattern', 'dependency_rule', 'troubleshooting'];
      for (const t of required) {
        if (!PRO_MEMORY_TYPES.includes(t as any)) throw new Error(`missing Pro type: ${t}`);
      }
    }),
    await check('G6-pro.3', 'parseLlmResponse handles JSON array, prose-wrapped, and reasoning-then-json', () => {
      const a = parseLlmResponse(JSON.stringify([{ type: 'fact', content: 'BLAKE3 is fast and modern', confidence: 0.9 }]), 'ce:1');
      if (a.length !== 1) throw new Error('plain JSON not parsed');
      const b = parseLlmResponse('Sure! [{"type":"preference","content":"prefers Rust over Go","confidence":0.9}]', 'ce:1');
      if (b.length !== 1) throw new Error('prose-wrapped not parsed');
      const c = parseLlmResponse('Reasoning: ...\nJSON:\n[{"type":"task","content":"finish phase 5 by tomorrow","confidence":0.9}]', 'ce:1');
      if (c.length !== 1) throw new Error('reasoning-then-json not parsed');
    }),
    await check('G6-pro.4', 'parseVerificationVerdict + InvalidLlmResponseError on bad JSON', () => {
      const v = parseVerificationVerdict('{"valid":true,"reason":"ok"}');
      if (!v.valid) throw new Error('verdict not parsed');
      let caught = false;
      try { parseVerificationVerdict('not json'); } catch (e) { caught = e instanceof InvalidLlmResponseError; }
      if (!caught) throw new Error('bad JSON not rejected');
    }),
    await check('G6-pro.5', 'type mapping for all 13 Pro types is total', () => {
      for (const t of PRO_MEMORY_TYPES) {
        const oss = mapProToOssMemoryType(t);
        if (!oss) throw new Error(`mapping for ${t} returned ${oss}`);
      }
      if (!isProOnlyType('code_pattern')) throw new Error('isProOnlyType wrong');
      if (isProOnlyType('fact')) throw new Error('isProOnlyType wrong');
    }),
    await check('G6-pro.6', 'distillBatch end-to-end with 2-pass verification', async () => {
      const { dir, conn, chat, memStore } = await freshKb();
      try {
        const adapter = mockAdapter([
          JSON.stringify([{ type: 'preference', content: 'prefers Rust for runtime work', confidence: 0.9 }]),
          JSON.stringify({ valid: true, reason: 'matches source' }),
        ]);
        const d = new LlmDistiller({ memStore, chatConn: conn, adapter, scopeId: SCOPE, config: { verificationPasses: 2 } });
        const s = chat.createSession({ scopeId: SCOPE, title: 't' });
        await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'I prefer Rust for runtime work', metadata: {} });
        const stats = await d.distillBatch();
        if (stats.llmCallsTotal !== 2) throw new Error(`expected 2 LLM calls, got ${stats.llmCallsTotal}`);
        if (stats.memoriesCreated < 1) throw new Error('no memory created');
      } finally { await tear(dir, conn); }
    }),
    await check('G6-pro.7', 'verifier rejection prevents memory creation', async () => {
      const { dir, conn, chat, memStore } = await freshKb();
      try {
        const adapter = mockAdapter([
          JSON.stringify([{ type: 'fact', content: 'hallucinated content not in source text', confidence: 0.9 }]),
          JSON.stringify({ valid: false, reason: 'not derivable from source' }),
        ]);
        const d = new LlmDistiller({ memStore, chatConn: conn, adapter, scopeId: SCOPE, config: { verificationPasses: 2 } });
        const s = chat.createSession({ scopeId: SCOPE, title: 't' });
        await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'small source', metadata: {} });
        const stats = await d.distillBatch();
        if (stats.verificationFailures < 1) throw new Error('verification failure not counted');
        if (stats.memoriesCreated !== 0) throw new Error('memory created despite rejection');
      } finally { await tear(dir, conn); }
    }),
    await check('G6-pro.8', 'Pro-only type preserved in metadata.proType after storage', async () => {
      const { dir, conn, chat, memStore } = await freshKb();
      try {
        const adapter = mockAdapter([
          JSON.stringify([{ type: 'code_pattern', content: 'use Result<T, E> for fallible operations', confidence: 0.9 }]),
          JSON.stringify({ valid: true }),
        ]);
        const d = new LlmDistiller({ memStore, chatConn: conn, adapter, scopeId: SCOPE, config: { verificationPasses: 2 } });
        const s = chat.createSession({ scopeId: SCOPE, title: 't' });
        await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'rust patterns', metadata: {} });
        await d.distillBatch();
        const skills = memStore.listByType('skill');
        if (skills.length < 1) throw new Error('code_pattern not stored as skill');
        if (skills[0].metadata.proType !== 'code_pattern') throw new Error('proType not preserved');
        if (skills[0].metadata.isProOnlyType !== true) throw new Error('isProOnlyType flag wrong');
      } finally { await tear(dir, conn); }
    }),
    await check('G6-pro.9', 'token usage tracked across extraction + verification', async () => {
      const { dir, conn, chat, memStore } = await freshKb();
      try {
        const adapter = mockAdapter([
          JSON.stringify([{ type: 'fact', content: 'a durable fact extracted from source', confidence: 0.9 }]),
          JSON.stringify({ valid: true }),
        ]);
        const d = new LlmDistiller({ memStore, chatConn: conn, adapter, scopeId: SCOPE, config: { verificationPasses: 2 } });
        const s = chat.createSession({ scopeId: SCOPE, title: 't' });
        await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'source', metadata: {} });
        const stats = await d.distillBatch();
        if (stats.llmTokensIn <= 0) throw new Error('tokensIn not tracked');
        if (stats.llmTokensOut <= 0) throw new Error('tokensOut not tracked');
      } finally { await tear(dir, conn); }
    }),
    await check('G6-pro.10', 'watermark advances; second batch is no-op', async () => {
      const { dir, conn, chat, memStore } = await freshKb();
      try {
        const adapter = mockAdapter([
          JSON.stringify([{ type: 'fact', content: 'durable fact from source content', confidence: 0.9 }]),
          JSON.stringify({ valid: true }),
        ]);
        const d = new LlmDistiller({ memStore, chatConn: conn, adapter, scopeId: SCOPE, config: { verificationPasses: 2 } });
        const s = chat.createSession({ scopeId: SCOPE, title: 't' });
        await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'source content', metadata: {} });
        const first = await d.distillBatch();
        const second = await d.distillBatch();
        if (first.entriesScanned !== 1 || second.entriesScanned !== 0) {
          throw new Error(`watermark broken: first=${first.entriesScanned}, second=${second.entriesScanned}`);
        }
      } finally { await tear(dir, conn); }
    }),
    await check('G6-pro.11', 'minConfidence filter respected', async () => {
      const { dir, conn, chat, memStore } = await freshKb();
      try {
        const adapter = mockAdapter([
          JSON.stringify([
            { type: 'fact', content: 'low confidence fact, should be filtered out', confidence: 0.4 },
            { type: 'fact', content: 'high confidence fact, should be kept', confidence: 0.95 },
          ]),
          JSON.stringify({ valid: true }),
        ]);
        const d = new LlmDistiller({
          memStore, chatConn: conn, adapter, scopeId: SCOPE,
          config: { minConfidence: 0.8, verificationPasses: 2 },
        });
        const s = chat.createSession({ scopeId: SCOPE, title: 't' });
        await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'mixed quality input', metadata: {} });
        const stats = await d.distillBatch();
        if (stats.candidatesExtracted !== 1) throw new Error(`expected 1 candidate after filter, got ${stats.candidatesExtracted}`);
      } finally { await tear(dir, conn); }
    }),
  ];
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const checks = await runChecks();
  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : (passed === 0 ? 'fail' : 'partial');

  const report = {
    gateId: 'G6-pro', title: 'LLM Distiller Behavior',
    status, startedAt, finishedAt: new Date().toISOString(),
    durationMs: Date.now() - start, checks,
    summary: { total: checks.length, passed, failed },
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  const ts = startedAt.replace(/[:.]/g, '-');
  writeFileSync(join(REPORT_DIR, `G6-pro-${ts}.json`), JSON.stringify(report, null, 2));

  const line = '─'.repeat(80);
  console.log(line);
  console.log(`Gate G6-pro: LLM Distiller Behavior`);
  console.log(`Status: ${status.toUpperCase()}  (${passed}/${checks.length} passed, ${report.durationMs}ms)`);
  console.log(line);
  for (const c of checks) {
    const icon = c.status === 'pass' ? '✓' : '✗';
    console.log(`${icon} ${c.id.padEnd(11)} ${c.description.slice(0, 55).padEnd(55)} ${String(c.durationMs).padStart(6)}ms`);
    if (c.error) console.log(`    error: ${c.error.message.split('\n')[0]}`);
  }
  console.log(line);

  process.exit(status === 'pass' ? 0 : 1);
}

main().catch((e) => { console.error('G6-pro crashed:', e); process.exit(2); });
