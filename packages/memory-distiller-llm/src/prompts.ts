// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-005 LLM Prompts
// @gate G6-pro.2

import type { ChatMessage } from '@orqenix/llm-adapter-ollama';
import {
  ExtractionDraftSchema, InvalidLlmResponseError,
  PRO_MEMORY_TYPES, type ExtractionDraft, type LlmDistillerConfig,
} from './contracts.js';

const TYPE_LIST = PRO_MEMORY_TYPES.join(' | ');

function systemPrompt(config: LlmDistillerConfig): string {
  return [
    'You are a knowledge extraction assistant for a local-first memory system.',
    `Extract durable memories from the user message. Output ONLY a JSON array.`,
    `Each item: { "type": "<${TYPE_LIST}>", "content": "<extracted text>", "confidence": <0..1>, "rationale": "<short reason>" }`,
    `Rules:`,
    `1. Only extract durable facts, preferences, decisions, code patterns, rules, etc. Skip small talk.`,
    `2. Confidence reflects how reliably this memory will be useful later.`,
    `3. Maximum ${config.maxCandidatesPerEntry} items.`,
    `4. Content must be self-contained (readable without the source).`,
    `5. Skip items with confidence < ${config.minConfidence}.`,
    `Return [] if nothing durable.`,
  ].join('\n');
}

function reasoningPrefix(): string {
  return [
    'First, briefly reason about what is durable in this message (1-3 sentences).',
    'Then output the JSON array on a new line, prefixed with "JSON:" on its own line.',
  ].join('\n');
}

export function buildExtractionMessages(
  text: string, sourceEntryId: string, config: LlmDistillerConfig,
): ChatMessage[] {
  const system = config.promptStyle === 'reasoning-then-json'
    ? `${systemPrompt(config)}\n\n${reasoningPrefix()}`
    : systemPrompt(config);
  const user = `Source entry id: ${sourceEntryId}\nText:\n${text}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function buildVerificationMessages(draft: ExtractionDraft, sourceText: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You are a verification critic. You are given a memory draft and its source text.',
        'Decide if the draft is faithfully derivable from the source AND durable enough to keep.',
        'Output ONLY a JSON object: { "valid": true|false, "reason": "<short>" }',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Source text:\n${sourceText}`,
        '',
        `Draft:`,
        JSON.stringify({ type: draft.type, content: draft.content, confidence: draft.confidence, rationale: draft.rationale }, null, 2),
      ].join('\n'),
    },
  ];
}

function extractJsonFromMaybePrefixed(raw: string): string {
  // Allow "reasoning-then-json" outputs that prefix with "JSON:" line or stray text.
  const idx = raw.lastIndexOf('JSON:');
  if (idx >= 0) raw = raw.slice(idx + 5);
  // Find first '[' and matching ']'
  const openArr = raw.indexOf('[');
  if (openArr >= 0) {
    const lastClose = raw.lastIndexOf(']');
    if (lastClose > openArr) return raw.slice(openArr, lastClose + 1);
  }
  // Or a top-level object for verification
  const openObj = raw.indexOf('{');
  if (openObj >= 0) {
    const lastCloseObj = raw.lastIndexOf('}');
    if (lastCloseObj > openObj) return raw.slice(openObj, lastCloseObj + 1);
  }
  return raw.trim();
}

export function parseLlmResponse(raw: string, sourceEntryId: string): ExtractionDraft[] {
  const json = extractJsonFromMaybePrefixed(raw);
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { throw new InvalidLlmResponseError(raw); }
  if (!Array.isArray(parsed)) {
    if (parsed === null || (typeof parsed === 'object' && Object.keys(parsed as object).length === 0)) {
      return [];
    }
    throw new InvalidLlmResponseError(raw);
  }
  const out: ExtractionDraft[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const candidate = {
      type: obj.type,
      content: obj.content,
      confidence: typeof obj.confidence === 'number' ? obj.confidence : Number(obj.confidence),
      sourceEntryId,
      rationale: typeof obj.rationale === 'string' ? obj.rationale : undefined,
      verificationPass: 0,
    };
    const r = ExtractionDraftSchema.safeParse(candidate);
    if (r.success) out.push(r.data);
    // silently drop malformed individual items; caller can read stats
  }
  return out;
}

export function parseVerificationVerdict(raw: string): { valid: boolean; reason?: string } {
  const json = extractJsonFromMaybePrefixed(raw);
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { throw new InvalidLlmResponseError(raw); }
  if (!parsed || typeof parsed !== 'object') throw new InvalidLlmResponseError(raw);
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.valid !== 'boolean') throw new InvalidLlmResponseError(raw);
  return {
    valid: obj.valid,
    reason: typeof obj.reason === 'string' ? obj.reason : undefined,
  };
}
