// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import {
  startChain, appendStep, validate, validateChainLinkage, validateDepth,
  validateCapNarrowing, validateRemainingHops,
  DelegationDepthExceededError, DelegationChainBrokenError, CapabilityNarrowingViolation,
  type DelegationChain,
} from '../src';

const A = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const C = 'scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const D = 'scope:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
const TOK_AB = 'tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
const TOK_BC = 'tok:EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';
const TOK_CD = 'tok:FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';

describe('startChain + appendStep', () => {
  it('startChain builds a 1-step chain', () => {
    const c = startChain(A, {
      delegateScopeId: B,
      tokenJti: TOK_AB,
      caps: ['read:kb-docs', 'query:kb-docs'],
      delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    expect(c.steps).toHaveLength(1);
    expect(c.maxDepth).toBe(3);
    expect(c.steps[0].remainingHops).toBe(3);
  });

  it('appendStep grows the chain with cap narrowing', () => {
    const c1 = startChain(A, {
      delegateScopeId: B,
      tokenJti: TOK_AB,
      caps: ['read:kb-docs', 'query:kb-docs'],
      delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    const c2 = appendStep(c1, {
      delegateScopeId: C,
      tokenJti: TOK_BC,
      caps: ['read:kb-docs'],
      delegatedAt: '2026-06-02T00:01:00Z',
    });
    expect(c2.steps).toHaveLength(2);
    expect(c2.steps[1].remainingHops).toBe(2);
  });

  it('appendStep rejects when child caps include a non-parent cap', () => {
    const c1 = startChain(A, {
      delegateScopeId: B,
      tokenJti: TOK_AB,
      caps: ['read:kb-docs'],
      delegatedAt: '2026-06-02T00:00:00Z',
    }, 3);
    expect(() => appendStep(c1, {
      delegateScopeId: C,
      tokenJti: TOK_BC,
      caps: ['read:kb-docs', 'write:kb-docs'],
      delegatedAt: '2026-06-02T00:01:00Z',
    })).toThrow(CapabilityNarrowingViolation);
  });

  it('appendStep rejects when depth would exceed maxDepth', () => {
    let c: DelegationChain = startChain(A, {
      delegateScopeId: B, tokenJti: TOK_AB, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z',
    }, 1);
    expect(() => appendStep(c, {
      delegateScopeId: C, tokenJti: TOK_BC, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:01:00Z',
    })).toThrow(DelegationDepthExceededError);
  });
});

describe('validate + sub-validators', () => {
  function mkChain(): DelegationChain {
    let c = startChain(A, { delegateScopeId: B, tokenJti: TOK_AB, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z' }, 3);
    c = appendStep(c, { delegateScopeId: C, tokenJti: TOK_BC, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:01:00Z' });
    c = appendStep(c, { delegateScopeId: D, tokenJti: TOK_CD, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:02:00Z' });
    return c;
  }

  it('validate passes on legitimate chain', () => {
    const c = mkChain();
    expect(() => validate(c)).not.toThrow();
  });

  it('validateChainLinkage catches mismatched delegator-delegate handoff', () => {
    const c = mkChain();
    const broken: DelegationChain = {
      ...c,
      steps: [c.steps[0], { ...c.steps[1], delegatorScopeId: D }, c.steps[2]],
    };
    expect(() => validateChainLinkage(broken)).toThrow(DelegationChainBrokenError);
  });

  it('validateDepth catches over-cap chain length', () => {
    const c = mkChain();
    const overlong: DelegationChain = { ...c, maxDepth: 2 };
    expect(() => validateDepth(overlong)).toThrow(DelegationDepthExceededError);
  });

  it('validateCapNarrowing catches widened caps', () => {
    const c = mkChain();
    const widened: DelegationChain = {
      ...c,
      steps: [
        c.steps[0],
        { ...c.steps[1], caps: ['read:kb-docs', 'write:kb-docs'] },
        c.steps[2],
      ],
    };
    expect(() => validateCapNarrowing(widened)).toThrow(CapabilityNarrowingViolation);
  });

  it('validateRemainingHops catches wrong hop counter', () => {
    const c = mkChain();
    const broken: DelegationChain = {
      ...c,
      steps: [
        c.steps[0],
        { ...c.steps[1], remainingHops: 5 },
        c.steps[2],
      ],
    };
    expect(() => validateRemainingHops(broken)).toThrow(DelegationChainBrokenError);
  });

  it('validate at root rejects originScopeId mismatch', () => {
    const c = startChain(A, { delegateScopeId: B, tokenJti: TOK_AB, caps: ['read:kb-docs'], delegatedAt: '2026-06-02T00:00:00Z' }, 3);
    const broken: DelegationChain = { ...c, originScopeId: D };
    expect(() => validate(broken)).toThrow();
  });
});
