// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-006 Delegated Router
// @gate G36-pro.3, G36-pro.4

import type { MeshRouter, MeshQueryHit, MeshQueryResponse } from '@orqenix/mesh-routing';
import type { ScopeLinkStore } from '@orqenix/scope-link';
import { rootTag, appendTag, type ProvenanceChain } from '@orqenix/provenance';
import {
  validate, validateDepth,
} from './chain.js';
import {
  type DelegatedQueryInput, type DelegationChain,
  DelegationDepthExceededError, DelegationUnauthorizedError,
} from './contracts.js';

export interface DelegatedQueryResponse extends MeshQueryResponse {
  chainHops: number;
  originScopeId: string;
  delegationChain: DelegationChain;
}

export interface DelegatedMeshRouterOptions {
  localScopeId: string;
  baseRouter: MeshRouter;
  linkStore: ScopeLinkStore;
  now?: () => string;
}

export class DelegatedMeshRouter {
  private readonly localScopeId: string;
  private readonly baseRouter: MeshRouter;
  private readonly linkStore: ScopeLinkStore;
  private readonly now: () => string;

  constructor(opts: DelegatedMeshRouterOptions) {
    this.localScopeId = opts.localScopeId;
    this.baseRouter = opts.baseRouter;
    this.linkStore = opts.linkStore;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  private tagHitsWithChain(hits: MeshQueryHit[], chain: DelegationChain): MeshQueryHit[] {
    return hits.map((h) => {
      let provenance: ProvenanceChain = h.provenance;
      // Append a tag for each delegation step so downstream verifiers see the lineage.
      for (const step of chain.steps) {
        try {
          provenance = appendTag(provenance, {
            sourceScopeId: step.delegateScopeId,
            sourceKind: 'mesh',
            tokenJti: step.tokenJti,
            producedAt: step.delegatedAt,
          });
        } catch {
          // if the chain rejects (broken provenance), keep original
          return h;
        }
      }
      return { ...h, provenance };
    });
  }

  async delegatedQuery(input: DelegatedQueryInput): Promise<DelegatedQueryResponse> {
    validate(input.chain);
    if (input.chain.steps[0]!.delegatorScopeId !== this.localScopeId) {
      throw new DelegationUnauthorizedError(
        `chain originates at ${input.chain.steps[0]!.delegatorScopeId}, not local ${this.localScopeId}`,
      );
    }
    // Determine the actual target (last delegate in chain)
    const finalStep = input.chain.steps[input.chain.steps.length - 1]!;
    const targetScopeId = finalStep.delegateScopeId;

    const base = await this.baseRouter.query({
      text: input.text,
      k: input.k ?? 5,
      timeoutMs: input.timeoutMs ?? 5_000,
      targetScopeIds: [targetScopeId],
    });

    const taggedHits = this.tagHitsWithChain(base.hits, input.chain);

    return {
      ...base,
      hits: taggedHits,
      chainHops: input.chain.steps.length,
      originScopeId: input.chain.originScopeId,
      delegationChain: input.chain,
    };
  }

  /**
   * Forward a delegated query received from upstream. Validates chain and either:
   *   - resolves locally (if this scope is the final delegate), or
   *   - extends the chain by 1 hop toward the next link (if remaining hops allow it).
   */
  async forwardQuery(input: DelegatedQueryInput, nextDelegateScopeId?: string): Promise<DelegatedQueryResponse> {
    validate(input.chain);
    const finalStep = input.chain.steps[input.chain.steps.length - 1]!;
    const amIFinal = finalStep.delegateScopeId === this.localScopeId;

    if (amIFinal && !nextDelegateScopeId) {
      // Resolve locally; behave as if base router had this scope as the target.
      const base = await this.baseRouter.query({
        text: input.text,
        k: input.k ?? 5,
        timeoutMs: input.timeoutMs ?? 5_000,
      });
      const taggedHits = this.tagHitsWithChain(base.hits, input.chain);
      return {
        ...base,
        hits: taggedHits,
        chainHops: input.chain.steps.length,
        originScopeId: input.chain.originScopeId,
        delegationChain: input.chain,
      };
    }

    if (!nextDelegateScopeId) {
      throw new DelegationUnauthorizedError(
        `local scope ${this.localScopeId} is not the final delegate and no next hop provided`,
      );
    }

    if (finalStep.remainingHops <= 0) {
      throw new DelegationDepthExceededError(input.chain.steps.length, input.chain.maxDepth);
    }

    // Forward to the next hop by querying baseRouter with the next scope as the explicit target.
    const base = await this.baseRouter.query({
      text: input.text,
      k: input.k ?? 5,
      timeoutMs: input.timeoutMs ?? 5_000,
      targetScopeIds: [nextDelegateScopeId],
    });
    const taggedHits = this.tagHitsWithChain(base.hits, input.chain);
    return {
      ...base,
      hits: taggedHits,
      chainHops: input.chain.steps.length,
      originScopeId: input.chain.originScopeId,
      delegationChain: input.chain,
    };
  }

  getMaxAllowedDepth(): number { return 8; }

  assertChainSane(chain: DelegationChain): void {
    validate(chain);
    validateDepth(chain);
  }
}
