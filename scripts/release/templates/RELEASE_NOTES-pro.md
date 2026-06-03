# Release Notes — Orqenix-Pro v0.5.0-phase-5

**Release date**: 2026-06-03
**License**: Business Source License 1.1 (changes to Apache 2.0 after 4 years)
**Phase**: 5 of N

## What's in this release

The Pro tier of Orqenix. Every Pro package extends or replaces an OSS counterpart
with higher-performance backends, structured LLM-driven extraction, or operational
safety primitives. Cross-platform compatibility maintained via driver injection
pattern.

## Highlights

- **Polyglot backends** — Kuzu graph for code symbols, LanceDB for vector ANN
  search, LMDB for the token verifier cache
- **LLM-based distiller** — 13 memory types with 2-pass verification, 5 Pro-only
  types preserved via `metadata.proType`
- **Multi-hop mesh delegation** — up to 8 hops with capability narrowing and
  per-hop tokens
- **Blast-radius containment** — 5 quota kinds (writes per hour and per day,
  cross-scope writes, detach per day, KB bytes per day)
- **OSS to Pro migration tooling** — count-verified migration with
  ProMigrationVerificationError on drift
- **OSS↔Pro interop test suite** — 21 cases across 8 scenarios verifying every
  Pro package against its OSS counterpart

## Upgrading from OSS-only deployment

1. Install OSS first (Orqenix repo, Apache 2.0)
2. Add Orqenix-Pro packages to your workspace (BSL-1.1)
3. Run `migrateCodeGraph`, `migrateEmbeddings`, `migrateTokenStore` from
   `@orqenix-pro/pro-migration` to copy data from OSS backends to Pro backends
4. OSS and Pro can coexist indefinitely; the Pro tier is opt-in per backend

## What's not in this release

- Pro CLI subcommands (`orqenix-pro delegate`, `orqenix-pro quota`) deferred to Phase 6
- G-interop formal charter gate (the 21 interop tests are validated but not yet
  promoted to a gated CI check) deferred to Phase 6
- Production native binding CI matrix for Kuzu / LanceDB / LMDB deferred to Phase 6

## Pro tier status

| Metric | Value |
|--------|-------|
| Pro packages | 7 production + 1 interop test |
| LOC | ~8,320 |
| Pro Charter Gates | 4 |
| Pro gate checks | 41 |
| OSS↔Pro interop test cases | 21 (all PASS in 3.47s) |

## Acceptance recipe

```bash
git clone <pro-repo>
cd Orqenix-Pro
pnpm install
pnpm tsx scripts/gates/G18-pro-polyglot-backend-conformance.ts
pnpm tsx scripts/gates/G6-pro-llm-distiller-behavior.ts
pnpm tsx scripts/gates/G36-pro-mesh-delegation-chain.ts
pnpm tsx scripts/gates/G37-pro-blast-radius-containment.ts
pnpm tsx scripts/gates/pro-final-integration.ts
pnpm --filter @orqenix-pro/integration-tests test
```

Expected outcome: 4 Pro gates PASS, integration smoke 6 stages PASS, interop
21 of 21 PASS.

## License clarification

The Business Source License 1.1 prohibits using the Licensed Work as a Commercial
Knowledge Mesh Service that competes with Orqenix Cloud. Four years after the
publish date, the Licensed Work converts automatically to Apache License 2.0.

For alternative licensing arrangements visit <https://orqenix.dev/licensing>.
