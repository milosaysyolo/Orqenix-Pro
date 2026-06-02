// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-006 Chain Validation
// @gate G36-pro.1, G36-pro.2

import {
  DelegationChainSchema, DelegationStepSchema,
  DelegationChainBrokenError, DelegationDepthExceededError, CapabilityNarrowingViolation,
  type DelegationChain, type DelegationStep,
} from './contracts.js';

export function validateChainLinkage(chain: DelegationChain): void {
  for (let i = 0; i < chain.steps.length - 1; i++) {
    if (chain.steps[i]!.delegateScopeId !== chain.steps[i + 1]!.delegatorScopeId) {
      throw new DelegationChainBrokenError(
        `step ${i + 1} delegator ${chain.steps[i + 1]!.delegatorScopeId} does not match step ${i} delegate ${chain.steps[i]!.delegateScopeId}`,
      );
    }
  }
}

export function validateDepth(chain: DelegationChain): void {
  if (chain.steps.length > chain.maxDepth) {
    throw new DelegationDepthExceededError(chain.steps.length, chain.maxDepth);
  }
}

export function validateCapNarrowing(chain: DelegationChain): void {
  for (let i = 1; i < chain.steps.length; i++) {
    const parent = new Set(chain.steps[i - 1]!.caps);
    for (const cap of chain.steps[i]!.caps) {
      if (!parent.has(cap)) {
        throw new CapabilityNarrowingViolation(
          `step ${i} introduces capability "${cap}" not present in parent step ${i - 1}`,
        );
      }
    }
  }
}

export function validateRemainingHops(chain: DelegationChain): void {
  for (let i = 0; i < chain.steps.length; i++) {
    const expected = chain.maxDepth - i;
    if (chain.steps[i]!.remainingHops !== expected) {
      throw new DelegationChainBrokenError(
        `step ${i} remainingHops ${chain.steps[i]!.remainingHops} expected ${expected}`,
      );
    }
  }
}

export function validate(chain: DelegationChain): void {
  DelegationChainSchema.parse(chain);
  validateDepth(chain);
  validateChainLinkage(chain);
  validateCapNarrowing(chain);
  validateRemainingHops(chain);
}

export interface AppendStepInput {
  delegateScopeId: string;
  tokenJti: string;
  caps: string[];
  delegatedAt: string;
}

export function appendStep(chain: DelegationChain, input: AppendStepInput): DelegationChain {
  const last = chain.steps[chain.steps.length - 1]!;
  if (last.remainingHops <= 0) {
    throw new DelegationDepthExceededError(chain.steps.length, chain.maxDepth);
  }
  if (chain.steps.length >= chain.maxDepth) {
    throw new DelegationDepthExceededError(chain.steps.length, chain.maxDepth);
  }
  // cap narrowing: new step's caps must subset last step's caps
  const parentCaps = new Set(last.caps);
  for (const c of input.caps) {
    if (!parentCaps.has(c)) {
      throw new CapabilityNarrowingViolation(`new step introduces capability "${c}" not in parent`);
    }
  }
  const newStep: DelegationStep = DelegationStepSchema.parse({
    delegatorScopeId: last.delegateScopeId,
    delegateScopeId: input.delegateScopeId,
    tokenJti: input.tokenJti,
    caps: input.caps,
    delegatedAt: input.delegatedAt,
    remainingHops: last.remainingHops - 1,
  });
  const newChain: DelegationChain = {
    steps: [...chain.steps, newStep],
    originScopeId: chain.originScopeId,
    maxDepth: chain.maxDepth,
  };
  validate(newChain);
  return newChain;
}

export function startChain(originScopeId: string, firstStep: Omit<DelegationStep, 'delegatorScopeId' | 'remainingHops'>, maxDepth: number): DelegationChain {
  const step: DelegationStep = DelegationStepSchema.parse({
    delegatorScopeId: originScopeId,
    delegateScopeId: firstStep.delegateScopeId,
    tokenJti: firstStep.tokenJti,
    caps: firstStep.caps,
    delegatedAt: firstStep.delegatedAt,
    remainingHops: maxDepth,
  });
  const chain: DelegationChain = {
    steps: [step],
    originScopeId,
    maxDepth,
  };
  validate(chain);
  return chain;
}
