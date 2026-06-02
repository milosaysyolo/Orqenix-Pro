// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import {
  buildExtractionMessages, buildVerificationMessages,
  parseLlmResponse, parseVerificationVerdict,
  InvalidLlmResponseError, DEFAULT_LLM_DISTILLER_CONFIG, PRO_MEMORY_TYPES,
  type ExtractionDraft,
} from '../src';

describe('prompt builders', () => {
  it('extraction system prompt lists all 13 types', () => {
    const msgs = buildExtractionMessages('text', 'ce:1', DEFAULT_LLM_DISTILLER_CONFIG);
    expect(msgs[0].role).toBe('system');
    for (const t of PRO_MEMORY_TYPES) {
      expect(msgs[0].content).toContain(t);
    }
  });

  it('structured-json style omits reasoning prefix', () => {
    const cfg = { ...DEFAULT_LLM_DISTILLER_CONFIG, promptStyle: 'structured-json' as const };
    const msgs = buildExtractionMessages('text', 'ce:1', cfg);
    expect(msgs[0].content).not.toContain('reason about what is durable');
  });

  it('reasoning-then-json style includes reasoning prefix', () => {
    const msgs = buildExtractionMessages('text', 'ce:1', DEFAULT_LLM_DISTILLER_CONFIG);
    expect(msgs[0].content).toContain('reason');
  });

  it('verification messages include source + draft', () => {
    const draft: ExtractionDraft = {
      type: 'preference', content: 'prefers Rust', confidence: 0.9,
      sourceEntryId: 'ce:1', verificationPass: 0,
    };
    const msgs = buildVerificationMessages(draft, 'Original text: I prefer Rust.');
    expect(msgs[1].content).toContain('Original text');
    expect(msgs[1].content).toContain('prefers Rust');
  });
});

describe('parseLlmResponse', () => {
  it('parses plain JSON array', () => {
    const raw = JSON.stringify([
      { type: 'preference', content: 'I prefer Rust for runtime work', confidence: 0.9, rationale: 'explicit statement' },
    ]);
    const drafts = parseLlmResponse(raw, 'ce:1');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe('preference');
    expect(drafts[0].sourceEntryId).toBe('ce:1');
  });

  it('parses reasoning-then-json output (JSON: marker)', () => {
    const raw = `Thinking: the user prefers Rust.\nJSON:\n[{"type":"preference","content":"I prefer Rust for runtime work","confidence":0.9}]`;
    const drafts = parseLlmResponse(raw, 'ce:1');
    expect(drafts).toHaveLength(1);
  });

  it('returns empty for null / empty object', () => {
    expect(parseLlmResponse('null', 'ce:1')).toEqual([]);
    expect(parseLlmResponse('{}', 'ce:1')).toEqual([]);
  });

  it('drops malformed individual items', () => {
    const raw = JSON.stringify([
      { type: 'preference', content: 'valid item, long enough', confidence: 0.9 },
      { type: 'INVALID_TYPE', content: 'should be dropped', confidence: 0.9 },
      { type: 'fact', content: 'short', confidence: 0.9 },
    ]);
    const drafts = parseLlmResponse(raw, 'ce:1');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].content).toMatch(/valid item/);
  });

  it('throws on non-JSON', () => {
    expect(() => parseLlmResponse('hello world not json', 'ce:1')).toThrow(InvalidLlmResponseError);
  });

  it('extracts JSON from prose-wrapped output', () => {
    const raw = `Sure, here is the result: [{"type":"fact","content":"BLAKE3 is fast","confidence":0.8}] hope that helps.`;
    const drafts = parseLlmResponse(raw, 'ce:1');
    expect(drafts).toHaveLength(1);
  });

  it('accepts Pro-only types', () => {
    const raw = JSON.stringify([
      { type: 'code_pattern', content: 'use Result<T, E> for fallible operations', confidence: 0.9 },
      { type: 'anti_pattern', content: 'avoid mutex-guarded global state for hot paths', confidence: 0.85 },
    ]);
    const drafts = parseLlmResponse(raw, 'ce:1');
    expect(drafts.map((d) => d.type).sort()).toEqual(['anti_pattern', 'code_pattern']);
  });
});

describe('parseVerificationVerdict', () => {
  it('parses true verdict with reason', () => {
    const v = parseVerificationVerdict('{"valid": true, "reason": "matches source"}');
    expect(v.valid).toBe(true);
    expect(v.reason).toBe('matches source');
  });

  it('parses false verdict', () => {
    const v = parseVerificationVerdict('{"valid": false, "reason": "hallucinated"}');
    expect(v.valid).toBe(false);
  });

  it('throws on missing valid field', () => {
    expect(() => parseVerificationVerdict('{"foo": 1}')).toThrow(InvalidLlmResponseError);
  });

  it('throws on non-JSON', () => {
    expect(() => parseVerificationVerdict('not json')).toThrow(InvalidLlmResponseError);
  });

  it('extracts JSON from prose', () => {
    const v = parseVerificationVerdict('Here is the verdict: {"valid":true,"reason":"ok"} done.');
    expect(v.valid).toBe(true);
  });
});
