// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-006 Mesh Delegation Contracts
// @gate G36-pro

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';
import { SCOPE_ID_PATTERN } from '@orqenix/scope-identity';
import { TOKEN_ID_PATTERN } from '@orqenix/capability-tokens';

export const DelegationStepSchema = z.object({
  delegatorScopeId: z.string().regex(SCOPE_ID_PATTERN),
  delegateScopeId: z.string().regex(SCOPE_ID_PATTERN),
  tokenJti: z.string().regex(TOKEN_ID_PATTERN),
  caps: z.array(z.string()).min(1).max(64),
  delegatedAt: z.string(),
  remainingHops: z.number().int().min(0).max(8),
}).strict();
export type DelegationStep = z.infer<typeof DelegationStepSchema>;

export const DelegationChainSchema = z.object({
  steps: z.array(DelegationStepSchema).min(1).max(8),
  originScopeId: z.string().regex(SCOPE_ID_PATTERN),
  maxDepth: z.number().int().min(1).max(8),
}).strict().refine((c) => c.steps[0]!.delegatorScopeId === c.originScopeId, {
  message: 'first step delegator must equal originScopeId',
});
export type DelegationChain = z.infer<typeof DelegationChainSchema>;

export interface DelegatedQueryInput {
  text: string;
  k?: number;
  timeoutMs?: number;
  chain: DelegationChain;
}

export class DelegationDepthExceededError extends OrqenixError {
  constructor(depth: number, max: number) { super(`delegation depth ${depth} exceeds max ${max}`, 'DELEGATION_DEPTH'); }
}
export class DelegationChainBrokenError extends OrqenixError {
  constructor(reason: string) { super(`delegation chain broken: ${reason}`, 'DELEGATION_CHAIN'); }
}
export class CapabilityNarrowingViolation extends OrqenixError {
  constructor(reason: string) { super(`capability narrowing violation: ${reason}`, 'DELEGATION_NARROW'); }
}
export class DelegationUnauthorizedError extends OrqenixError {
  constructor(reason: string) { super(`delegation unauthorized: ${reason}`, 'DELEGATION_UNAUTH'); }
}
