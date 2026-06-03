# @orqenix-pro/integration-tests

Comprehensive OSS↔Pro interoperability test suite. Verifies that every Pro package correctly extends, replaces, or augments the OSS package it depends on, without breaking OSS invariants.

## What is tested

| # | Scenario | Pro packages exercised |
|---|----------|------------------------|
| 1 | OSS ChatKB -> Pro LlmDistiller -> OSS recall (3 sub-tests) | memory-distiller-llm |
| 2 | Shared watermark between OSS HeuristicDistiller and Pro LlmDistiller (3 sub-tests) | memory-distiller-llm |
| 3 | Pro mesh-delegation extends OSS mesh-routing with multi-hop chains (3 sub-tests) | mesh-delegation |
| 4 | Pro blast-radius gates OSS writes (4 sub-tests, includes DEFAULT_QUOTAS) | blast-radius |
| 5 | Polyglot Pro backends coexist with OSS SQLite KB (2 sub-tests) | kb-code-graph, kb-embedding-lance, kb-token-store |
| 6 | OSS detach respects Pro detach_per_day quota (2 sub-tests) | blast-radius |
| 7 | Pro migration tooling preserves OSS data (2 sub-tests) | pro-migration |
| 8 | OSS AuditLog records both OSS and Pro events in one chain (2 sub-tests) | mesh-delegation, blast-radius |

Total: **~21 interop test cases** across **8 scenarios** exercising **all 7 Pro packages** against **10+ OSS packages**.

## Acceptance

```bash
pnpm --filter @orqenix-pro/integration-tests test
```
