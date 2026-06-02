// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-005 LLM Distiller Contracts
// @gate G6-pro

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';

// OSS 8 + 5 Pro-specific = 13 types
export const PRO_MEMORY_TYPES = [
  // OSS 8 types (mirrored for compatibility with @orqenix/memory-tiers)
  'fact', 'preference', 'decision', 'task',
  'learning', 'relationship', 'skill', 'observation',
  // 5 Pro-specific structured types
  'decision_rationale',
  'code_pattern',
  'anti_pattern',
  'dependency_rule',
  'troubleshooting',
] as const;
export type ProMemoryType = (typeof PRO_MEMORY_TYPES)[number];

export const ExtractionDraftSchema = z.object({
  type: z.enum(PRO_MEMORY_TYPES),
  content: z.string().min(8).max(8 * 1024),
  confidence: z.number().min(0).max(1),
  sourceEntryId: z.string().min(1).max(128),
  rationale: z.string().max(2 * 1024).optional(),
  verificationPass: z.number().int().min(0).max(5),
}).strict();
export type ExtractionDraft = z.infer<typeof ExtractionDraftSchema>;

export const LlmDistillerConfigSchema = z.object({
  model: z.string().min(1).max(128).optional(),
  temperature: z.number().min(0).max(2).default(0.2),
  minConfidence: z.number().min(0).max(1).default(0.7),
  maxCandidatesPerEntry: z.number().int().min(1).max(20).default(8),
  verificationPasses: z.number().int().min(1).max(5).default(2),
  batchSize: z.number().int().min(1).max(200).default(20),
  enabledTypes: z.array(z.enum(PRO_MEMORY_TYPES)).default([...PRO_MEMORY_TYPES]),
  promptStyle: z.enum(['structured-json', 'reasoning-then-json']).default('reasoning-then-json'),
}).strict();
export type LlmDistillerConfig = z.infer<typeof LlmDistillerConfigSchema>;

export const DEFAULT_LLM_DISTILLER_CONFIG: LlmDistillerConfig = LlmDistillerConfigSchema.parse({});

export interface LlmDistillationStats {
  entriesScanned: number;
  candidatesExtracted: number;
  memoriesCreated: number;
  duplicatesSkipped: number;
  verificationFailures: number;
  llmCallsTotal: number;
  llmTokensIn: number;
  llmTokensOut: number;
  durationMs: number;
}

export class LlmExtractionError extends OrqenixError {
  constructor(reason: string) { super(`LLM extraction error: ${reason}`, 'LLM_EXTRACTION'); }
}
export class VerificationFailureError extends OrqenixError {
  constructor(reason: string) { super(`verification failure: ${reason}`, 'VERIFICATION_FAILURE'); }
}
export class InvalidLlmResponseError extends OrqenixError {
  constructor(raw: string) {
    super(`invalid LLM response (not JSON or wrong schema): ${raw.slice(0, 120)}...`, 'INVALID_LLM_RESPONSE');
  }
}
