# Changelog — Orqenix-Pro

All notable changes to the Orqenix-Pro repo. Format based on Keep a Changelog 1.1.

## [0.5.0-phase-5] — 2026-06-03

### Summary

Phase 5 Pro Tier. 8 packages including OSS↔Pro interop test suite, ~8,320 LOC,
4 Pro charter gates with 41 checks, plus 21 OSS↔Pro interop test cases. ALL GREEN.

### Added

#### Polyglot storage (Part 10)
- `@orqenix-pro/kb-code-graph` — Kuzu graph DB for code symbols and edges,
  InMemoryGraphDriver fallback for cross-platform tests
- `@orqenix-pro/kb-embedding-lance` — LanceDB vector ANN search with 3 metrics
  (cosine, l2, dot), InMemoryVectorDriver fallback
- `@orqenix-pro/kb-token-store` — LMDB-backed token verifier cache with hit /
  miss / expiration tracking, InMemoryKvDriver fallback
- `@orqenix-pro/pro-migration` — OSS to Pro backend migration with count
  verification, throws ProMigrationVerificationError on count drift

#### LLM distiller and mesh extensions (Part 11)
- `@orqenix-pro/memory-distiller-llm` — 13-type structured extraction with
  2-pass verification, 3 prompt styles, idempotent storage into OSS MemoryTierStore
- `@orqenix-pro/mesh-delegation` — multi-hop delegation chains up to depth 8 with
  capability narrowing and per-hop tokens
- `@orqenix-pro/blast-radius` — 5 quota kinds with time-windowed counters,
  DEFAULT_QUOTAS preset for sensible CR v7.1 defaults

#### OSS↔Pro interop validation
- `@orqenix-pro/integration-tests` — 8 scenarios with 21 test cases verifying
  every Pro package against its OSS counterpart

### Charter Gates

G6-pro (11 criteria), G18-pro (13 criteria), G36-pro (8 criteria), G37-pro
(9 criteria) — 4 Pro gates, 41 checks, ALL PASS.

### License

Business Source License 1.1. Change date: 4 years from publish. Change license:
Apache 2.0.

### Known Artifacts

- Native bindings for Kuzu, LanceDB, and LMDB require platform-specific builds.
  Each Pro package ships with an in-memory driver fallback for cross-platform CI.
- OSS dependencies use `file:../../../Orqenix/packages/...` in package.json
  (work-around: switch to `@orqenix/*` package names if a Windows installation
  fails with `ERR_INVALID_FILE_URL_PATH`).

### Phase Summary

| Metric | Value |
|--------|-------|
| Packages | 8 |
| LOC | ~8,320 |
| Charter Gates (Pro) | 4 |
| Charter Gate Checks | 41 |
| OSS↔Pro interop test cases | 21 |
| Unit tests | ~96 |
