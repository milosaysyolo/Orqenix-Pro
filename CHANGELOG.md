## v0.6.4-phase-6 - 2026-06-11 (Sprint D + closeout)

### Fixed
- Closes GAP #1 from v0.6.1-phase-6: all 7 OSS deps use clean caret semver
- Fixes workspace:* protocol bug in 6 OSS packages (Sprint D)
- Fixes file: paths bug in 3 Pro packages (Sprint D)
- Full forward-compatibility achieved across 13 deps

### Changed
- All Phase 6 OSS @orqenix/* packages republished without -phase-6 suffix
- Pro deps (blast-radius, mesh-delegation, polyglot-backend) at v0.5.1

### Deprecated
- @orqenix-pro/cli@0.6.0-phase-6 through v0.6.3-phase-6 (use ^0.6.4)
- 14 stale npm versions across OSS and Pro packages

### Install
npm install -g @orqenix-pro/cli@^0.6.4
# Changelog â€” Orqenix-Pro

All notable changes to the Orqenix-Pro repo. Format based on Keep a Changelog 1.1.

## [0.6.1-phase-6] - 2026-06-11

### Fixed

- Dependency specifications now use clean caret semver enabling forward-compatibility with future Phase 7+ releases
- Wildcard deps (`"*"`) on `@orqenix/mesh-routing` and `@orqenix/audit-log` replaced with explicit `^0.5.0` ranges
- `v0.6.0-phase-6` deprecated; users should upgrade with `npm install -g @orqenix-pro/cli@^0.6.1`

### Changed

- 4 Pro dependencies republished without phase tags:
  - `@orqenix-pro/license`: 0.4.0 (was 0.4.0-phase-4)
  - `@orqenix-pro/blast-radius`: 0.5.0 (was 0.5.0-phase-5)
  - `@orqenix-pro/mesh-delegation`: 0.5.0 (was 0.5.0-phase-5)
  - `@orqenix-pro/polyglot-backend`: 0.5.0 (was 0.5.0-phase-5)

### Policy

- From Phase 7 forward, package versions use clean semver without phase-N suffix

## [0.5.0-phase-5] â€” 2026-06-03

### Summary

Phase 5 Pro Tier. 8 packages including OSSâ†”Pro interop test suite, ~8,320 LOC,
4 Pro charter gates with 41 checks, plus 21 OSSâ†”Pro interop test cases. ALL GREEN.

### Added

#### Polyglot storage (Part 10)
- `@orqenix-pro/kb-code-graph` â€” Kuzu graph DB for code symbols and edges,
  InMemoryGraphDriver fallback for cross-platform tests
- `@orqenix-pro/kb-embedding-lance` â€” LanceDB vector ANN search with 3 metrics
  (cosine, l2, dot), InMemoryVectorDriver fallback
- `@orqenix-pro/kb-token-store` â€” LMDB-backed token verifier cache with hit /
  miss / expiration tracking, InMemoryKvDriver fallback
- `@orqenix-pro/pro-migration` â€” OSS to Pro backend migration with count
  verification, throws ProMigrationVerificationError on count drift

#### LLM distiller and mesh extensions (Part 11)
- `@orqenix-pro/memory-distiller-llm` â€” 13-type structured extraction with
  2-pass verification, 3 prompt styles, idempotent storage into OSS MemoryTierStore
- `@orqenix-pro/mesh-delegation` â€” multi-hop delegation chains up to depth 8 with
  capability narrowing and per-hop tokens
- `@orqenix-pro/blast-radius` â€” 5 quota kinds with time-windowed counters,
  DEFAULT_QUOTAS preset for sensible CR v7.1 defaults

#### OSSâ†”Pro interop validation
- `@orqenix-pro/integration-tests` â€” 8 scenarios with 21 test cases verifying
  every Pro package against its OSS counterpart

### Charter Gates

G6-pro (11 criteria), G18-pro (13 criteria), G36-pro (8 criteria), G37-pro
(9 criteria) â€” 4 Pro gates, 41 checks, ALL PASS.

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
| OSSâ†”Pro interop test cases | 21 |
| Unit tests | ~96 |
