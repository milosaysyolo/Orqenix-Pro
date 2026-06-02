// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-005 LLM Distiller
// @gate G6-pro.4, G6-pro.5

import type { LlmAdapter } from '@orqenix/llm-adapter-ollama';
import type { SqliteConnection } from '@orqenix/storage-sqlite';
import {
  MemoryTierStore, classifyInitialTier,
  type MemoryEntry, type MemoryType,
} from '@orqenix/memory-tiers';
import {
  LlmDistillerConfigSchema, DEFAULT_LLM_DISTILLER_CONFIG,
  VerificationFailureError,
  type ExtractionDraft, type LlmDistillationStats, type LlmDistillerConfig, type ProMemoryType,
} from './contracts.js';
import {
  buildExtractionMessages, buildVerificationMessages,
  parseLlmResponse, parseVerificationVerdict,
} from './prompts.js';
import { mapProToOssMemoryType, isProOnlyType } from './type-mapping.js';

interface ChatEntryRow {
  rowid: number;
  entry_id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface LlmDistillerOptions {
  memStore: MemoryTierStore;
  chatConn: SqliteConnection;
  adapter: LlmAdapter;
  scopeId: string;
  config?: Partial<LlmDistillerConfig>;
  now?: () => string;
}

export class LlmDistiller {
  private readonly memStore: MemoryTierStore;
  private readonly chatConn: SqliteConnection;
  private readonly adapter: LlmAdapter;
  private readonly scopeId: string;
  private readonly cfg: LlmDistillerConfig;
  private readonly now: () => string;

  constructor(opts: LlmDistillerOptions) {
    this.memStore = opts.memStore;
    this.chatConn = opts.chatConn;
    this.adapter = opts.adapter;
    this.scopeId = opts.scopeId;
    this.cfg = LlmDistillerConfigSchema.parse({ ...DEFAULT_LLM_DISTILLER_CONFIG, ...(opts.config ?? {}) });
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  private readWatermarkRowid(): number {
    const row = this.chatConn.prepare<{ last_entry_id: string | null }>(
      `SELECT last_entry_id FROM memory_distiller_watermarks WHERE scope_id = ?`,
    ).get(this.scopeId) as { last_entry_id: string | null } | undefined;
    if (!row || row.last_entry_id == null) return 0;
    const r = this.chatConn.prepare<{ rowid: number }>(
      `SELECT rowid FROM chat_entries WHERE entry_id = ?`,
    ).get(row.last_entry_id) as { rowid: number } | undefined;
    return r?.rowid ?? 0;
  }

  private writeWatermark(lastEntryId: string): void {
    this.chatConn.prepare(
      `INSERT INTO memory_distiller_watermarks (scope_id, last_entry_id, last_run_at)
       VALUES (?, ?, ?)
       ON CONFLICT(scope_id) DO UPDATE SET last_entry_id = excluded.last_entry_id, last_run_at = excluded.last_run_at`,
    ).run(this.scopeId, lastEntryId, this.now());
  }

  private readBatch(sinceRowid: number): ChatEntryRow[] {
    return this.chatConn.prepare<ChatEntryRow>(
      `SELECT rowid, entry_id, session_id, role, content, created_at
       FROM chat_entries
       WHERE rowid > ? AND role != 'system'
       ORDER BY rowid ASC
       LIMIT ?`,
    ).all(sinceRowid, this.cfg.batchSize) as ChatEntryRow[];
  }

  private async extract(text: string, sourceEntryId: string, stats: LlmDistillationStats): Promise<ExtractionDraft[]> {
    const messages = buildExtractionMessages(text, sourceEntryId, this.cfg);
    let raw: string;
    try {
      const r = await this.adapter.complete({
        messages, model: this.cfg.model, temperature: this.cfg.temperature, maxTokens: 1024,
      });
      stats.llmCallsTotal++;
      stats.llmTokensIn += r.tokensIn;
      stats.llmTokensOut += r.tokensOut;
      raw = r.content;
    } catch (e) {
      throw new VerificationFailureError(`extraction LLM call failed: ${(e as Error).message}`);
    }
    return parseLlmResponse(raw, sourceEntryId);
  }

  private async verify(draft: ExtractionDraft, sourceText: string, stats: LlmDistillationStats): Promise<ExtractionDraft> {
    let currentDraft = draft;
    for (let pass = 1; pass < this.cfg.verificationPasses; pass++) {
      const messages = buildVerificationMessages(currentDraft, sourceText);
      let raw: string;
      try {
        const r = await this.adapter.complete({
          messages, model: this.cfg.model, temperature: 0.0, maxTokens: 256,
        });
        stats.llmCallsTotal++;
        stats.llmTokensIn += r.tokensIn;
        stats.llmTokensOut += r.tokensOut;
        raw = r.content;
      } catch (e) {
        throw new VerificationFailureError(`verification LLM call failed: ${(e as Error).message}`);
      }
      const verdict = parseVerificationVerdict(raw);
      if (!verdict.valid) {
        throw new VerificationFailureError(`verifier rejected at pass ${pass}: ${verdict.reason ?? 'no reason'}`);
      }
      currentDraft = { ...currentDraft, verificationPass: pass };
    }
    return currentDraft;
  }

  async distillBatch(): Promise<LlmDistillationStats> {
    const started = Date.now();
    const stats: LlmDistillationStats = {
      entriesScanned: 0, candidatesExtracted: 0, memoriesCreated: 0,
      duplicatesSkipped: 0, verificationFailures: 0,
      llmCallsTotal: 0, llmTokensIn: 0, llmTokensOut: 0, durationMs: 0,
    };

    const since = this.readWatermarkRowid();
    const rows = this.readBatch(since);
    if (rows.length === 0) {
      stats.durationMs = Date.now() - started;
      return stats;
    }

    for (const row of rows) {
      stats.entriesScanned++;
      let drafts: ExtractionDraft[];
      try {
        drafts = await this.extract(row.content, row.entry_id, stats);
      } catch (e) {
        stats.verificationFailures++;
        if (e instanceof VerificationFailureError) continue;
        throw e;
      }

      drafts = drafts
        .filter((d) => d.confidence >= this.cfg.minConfidence)
        .filter((d) => this.cfg.enabledTypes.includes(d.type))
        .slice(0, this.cfg.maxCandidatesPerEntry);

      stats.candidatesExtracted += drafts.length;

      for (const d of drafts) {
        let verified: ExtractionDraft;
        try { verified = await this.verify(d, row.content, stats); }
        catch (e) {
          if (e instanceof VerificationFailureError) {
            stats.verificationFailures++;
            continue;
          }
          throw e;
        }

        const ossType: MemoryType = mapProToOssMemoryType(verified.type);
        const tier = classifyInitialTier(ossType, verified.confidence);
        const beforeCount = this.memStore.countByTier();
        this.memStore.insert({
          tier, type: ossType, content: verified.content,
          sourceEntryIds: [verified.sourceEntryId],
          confidence: verified.confidence,
          scopeId: this.scopeId,
          metadata: {
            proType: verified.type,
            isProOnlyType: isProOnlyType(verified.type),
            rationale: verified.rationale ?? null,
            verifiedPass: verified.verificationPass,
          },
        } as Omit<MemoryEntry, 'id' | 'contentHash' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>);
        const afterCount = this.memStore.countByTier();
        const totalBefore = beforeCount.working + beforeCount.episodic + beforeCount.semantic + beforeCount.procedural;
        const totalAfter = afterCount.working + afterCount.episodic + afterCount.semantic + afterCount.procedural;
        if (totalAfter > totalBefore) stats.memoriesCreated++;
        else stats.duplicatesSkipped++;
      }
    }

    const lastRow = rows[rows.length - 1];
    if (lastRow) this.writeWatermark(lastRow.entry_id);

    stats.durationMs = Date.now() - started;
    return stats;
  }

  async distillAll(maxBatches = 100): Promise<LlmDistillationStats[]> {
    const out: LlmDistillationStats[] = [];
    for (let i = 0; i < maxBatches; i++) {
      const s = await this.distillBatch();
      out.push(s);
      if (s.entriesScanned === 0) break;
    }
    return out;
  }
}
