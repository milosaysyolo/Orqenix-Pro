# @orqenix-pro/mesh-delegation

Multi-hop delegation chains for the Orqenix mesh (Pro tier, BSL-1.1).

## What OSS gives you (single-hop)

`@orqenix/mesh-routing` lets scope A query scope B if A has an active outbound link to B. One hop, no chaining.

## What Pro adds

A `DelegationChain` lets A → B → C → D up to `maxDepth = 8`, where each step:
- Carries its own capability token (`tokenJti`)
- Narrows the cap set vs the previous step (cannot widen)
- Decrements `remainingHops` so anybody in the chain can refuse to forward past their limit

## Invariants enforced

| Check | Function |
|-------|----------|
| Step[i].delegate == step[i+1].delegator | `validateChainLinkage` |
| chain.steps.length <= maxDepth | `validateDepth` |
| step[i+1].caps ⊆ step[i].caps | `validateCapNarrowing` |
| step[i].remainingHops == maxDepth - i | `validateRemainingHops` |

Charter gate: **G36-pro Mesh Delegation Chain**.
