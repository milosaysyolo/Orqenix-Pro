# v0.6.0-phase-6 — Pro CLI: Operator surface for the Orqenix mesh

> **Pro Phase 6 closes here.** `@orqenix-pro/cli` ships under BUSL 1.1 as the first operator-facing surface for the Orqenix mesh. It runs on top of the OSS Phase 6 transport/routing/security stack tagged at the same version in `milosaysyolo/Orqenix`. Ten subcommands across four charter gates G44-pro to G47-pro, no external CLI framework, no color library, no concrete Phase 5 Pro symbol imports inside subcommand source. Verified by two audit waves (D6P-F1 and D6P-F2).

This release was developed across **5 delivery docs** (D6.11A, D6.11B, D6.12, D6P-F1, D6P-F2) and totals approximately **5,400 LOC** of source, tests, gate runners, and audit documents.

---

## Highlights

- **Single Pro CLI**: `@orqenix-pro/cli@0.6.0-phase-6`, BUSL 1.1, ESM only, bin `orqenix`.
- **Zero external CLI/colour libs**: only `node:util.parseArgs`. No `yargs`, `commander`, `oclif`, `chalk`, `kleur`, `ansi-styles`.
- **License-gated on every invocation**: `auth` and every Pro command verify a Pro license token from `ORQENIX_PRO_LICENSE` env or `<configDir>/license.txt`. Exit code `3` reserved for license/entitlement failures.
- **Three output formats**: `--json`, `--table` (default), `--plain`. `--no-color` and `NO_COLOR` respected.
- **Unified Pro audit stream**: `delegation.revoke`, `quota.set`, `quota.reset`, and `backend.switch` all append to a single hash-chained audit log via the same `AuditLog` instance.
- **Lightweight runtime**: CLI `help` runs without loading any native modules. Native runtime dependencies (`@orqenix/mesh-routing`, `@orqenix/storage-sqlite`, `better-sqlite3`, `@mongodb-js/zstd`) are not imported by the CLI bin or subcommand source.
- **Tag-readiness verified twice**: D6P-F1 closed package import drift, D6P-F2 closed runtime bin smoke and package dry-run.

---

## Charter gates

All 4 Pro Phase 6 charter gates pass under the `verify-phase-6-pro` orchestrator.

| Gate | Subject | Criteria | Result |
|---|---|---|---|
| G44-pro | CLI Foundation (auth, output formats, exit codes, error UX) | 11 | ALL PASS |
| G45-pro | Mesh + Delegation (inspect, route, chain show, revoke with audit) | 4 | ALL PASS |
| G46-pro | Quota Tools (show, set, sequential set+reset with audit chain) | 3 | ALL PASS |
| G47-pro | Polyglot Backend Tools (status, switch with readiness probe + audit) | 2 | ALL PASS |

Verify on your machine:

```bash
node --import tsx scripts/gates/verify-phase-6-pro.ts
# Expected final line: ALL GATES PASS
```

---

## Subcommands

Ten subcommands wired by `packages/cli/bin/orqenix.mjs`:

| # | Command | Purpose | Exit codes |
|---|---|---|---|
| 1 | `auth status` | Show current Pro license status (subject, tier, expiry, jti) | 0 success, 3 auth |
| 2 | `mesh inspect` | Local transports, peers, breaker state, recent RPC stats | 0 success, 4 not found |
| 3 | `mesh route <scope>` | Trace probe RPC with per-hop transport and RTT | 0 ok, 3 denied, 5 timeout |
| 4 | `delegation chain show [--id <jti>]` | List all chains, or expand a specific multi-hop chain | 0 success, 4 not found |
| 5 | `delegation revoke <jti> --reason <text>` | Revoke a delegation, append tamper-evident audit entry | 0 success, 2 usage, 4 not found |
| 6 | `quota show` | List all quotas with current/limit/window/breach | 0 success |
| 7 | `quota set <kind> --limit <n>` | Set quota limit, audit type `quota.set` | 0 success, 2 usage |
| 8 | `quota reset <kind> [--reason <text>]` | Reset current window, audit type `quota.reset` | 0 success, 2 usage |
| 9 | `backend status` | List polyglot backends with active/ready/version/last_error | 0 success |
| 10 | `backend switch <kind>` | Switch active backend after readiness probe, audit `backend.switch` | 0 success, 1 not ready, 2 usage |

---

## Test coverage

Pro CLI package meets the locked thresholds (statements >= 85%, branches >= 85%, functions >= 85%, lines >= 85%) across the full subcommand surface.

| Metric | Value |
|---|---|
| Test files | 21 |
| Tests | 98 |
| Statements | 93.77% |
| Branches | 88.18% |
| Functions | 98.57% |
| TypeScript errors | 0 |

---

## Architecture (from D6.11A to D6.12)

```
User
 |
 v
bin/orqenix.mjs
 |
 +-- DefaultAuditLog (in-memory, SHA-256 hash chain, shared)
 +-- DefaultDelegationStore (in-memory)
 +-- DefaultBlastRadiusStore (in-memory, 5 quota kinds)
 +-- DefaultRouteProbe (lazy-imports @orqenix/mesh-routing only on first probe call)
 +-- PolyglotBackendManager (from @orqenix-pro/polyglot-backend stub)
 +-- ProLicenseVerifier (from @orqenix-pro/license)
 |
 v
Application (sole I/O owner: stdout, stderr, exit)
 |
 v
CommandRegistry (multi-token resolution, longest-match-first)
 |
 v
Subcommands (src/subcommands/*)
  - Use only LOCAL structural interfaces:
    QuotaStore, BackendManager, AuditLog,
    DelegationStore, RouteProbe, NodeInspector
  - Zero concrete @orqenix-pro/* imports in subcommand source
```

Key design constants:

- Application is the only place that touches `process.stdout`, `process.stderr`, `process.exit`.
- Exit code `3` is reserved exclusively for auth / entitlement failures.
- Multi-token commands (`mesh route`, `delegation chain show`, `quota set`) resolved by the registry as full keys.
- Subcommands depend only on local structural interfaces, allowing fakes in tests and adapter swaps at the bin layer.

---

## Architecture decisions

| ID | Decision | Reasoning |
|---|---|---|
| Pro-D1 | One `@orqenix-pro/cli` package, no separate CLI per Pro subsystem | Single binary surface; subcommand registry scales without splitting publication artifacts |
| Pro-D2 | Structural typing only inside `src/subcommands/*` | Tests inject fakes, real adapters live at `bin/` layer, no Phase 5 Pro internal coupling |
| Pro-D3 | Lightweight in-memory adapters as Phase 6 default | Allows CLI `help` and verification to run without native build tools; persistent adapters deferred |
| Pro-D4 | Lazy import for `@orqenix/mesh-routing` inside `DefaultRouteProbe.probe()` | Keeps native module load out of CLI startup path; only `mesh route` triggers it |
| Pro-D5 | Single shared `AuditLog` instance across delegation, quota, backend mutations | One unified hash-chained Pro mutation stream for operators |
| Pro-D6 | Exit code `3` reserved exclusively for license/entitlement failures | Tooling can detect entitlement issues distinctly from generic failures |
| Pro-D7 | `node:util.parseArgs` only, no external CLI framework | Zero dependency surface, full control over global flag parsing |
| Pro-D8 | Output via `--json`, `--table` (default), `--plain`, mutually exclusive | Predictable downstream parsing; CI-friendly |

---

## Two audit waves before this tag

This release was tag-blocked twice during pre-release review, both intentional.

**D6P-F1 (Pre-tag audit, 8 phases)**:

- Verified package identity, import resolution, structural typing.
- Discovered three concrete-package mismatches in `bin/orqenix.mjs`:
  - `@orqenix/audit-log` did not export `AppendOnlyAuditLog`.
  - `@orqenix-pro/mesh-delegation` did not export `DelegationStore`.
  - `@orqenix-pro/blast-radius` `BlastRadiusStore` API did not match the `QuotaStore` interface.
- Fixed by creating three in-memory bin adapters (`audit-log-default.mjs`, `delegation-store-default.mjs`, `blast-radius-default.mjs`).
- Skipped runtime bin smoke and `npm pack --dry-run` due to a transitive native module that could not be built in the audit environment.

**D6P-F2 (Runtime + pack closure, 9 phases)**:

- Rewrote the four bin adapters to be fully self-contained: no imports of `@orqenix/audit-log`, `@orqenix/storage-sqlite`, `better-sqlite3`, or `@mongodb-js/zstd`.
- Moved `@orqenix/mesh-routing` import inside `DefaultRouteProbe.probe()` so CLI startup never loads native modules.
- Verified `node packages/cli/bin/orqenix.mjs help` exits 0 in real time.
- Verified `ORQENIX_PRO_LICENSE=invalid orqenix auth status` exits 3.
- Verified `ORQENIX_PRO_LICENSE=invalid orqenix quota show` exits 3.
- Created `packages/cli/LICENSE` and `packages/cli/CHANGELOG.md`.
- Verified `npm pack packages/cli --dry-run` includes `bin/`, `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`, and excludes `test/`, `scripts/`, audit files.
- Appended a correction note to D6P-F1 documents clarifying the two checks that were originally skipped.

After D6P-F2, every previously-skipped check passed for real.

---

## Anti-pattern guarantees (verified at tag time)

The release verification script runs these greps before tagging:

```bash
grep -R "@orqenix/audit-log\|@orqenix/storage-sqlite\|better-sqlite3\|@mongodb-js/zstd" \
  packages/cli/bin packages/cli/src           # empty
grep -R "—" packages/cli/src packages/cli/bin  # empty (no em-dash)
grep -R "yargs\|commander\|oclif" packages/cli/* # empty
grep -R "chalk\|kleur\|ansi-styles" packages/cli/* # empty
```

---

## Quick start

```bash
# Install Pro CLI globally (once the npm package is published)
npm install -g @orqenix-pro/cli

# Get a Pro license token from your operator
export ORQENIX_PRO_LICENSE=<your-token>

# Check status
orqenix auth status --json

# Inspect local mesh
orqenix mesh inspect
orqenix mesh route scp_b3_<remote-scope>

# Manage delegation chains
orqenix delegation chain show
orqenix delegation chain show --id <jti>
orqenix delegation revoke <jti> --reason "rotation 2026-Q2"

# Manage quotas
orqenix quota show
orqenix quota set rpc_calls_per_min --limit 500
orqenix quota reset rpc_calls_per_min --reason "burst recovery"

# Manage polyglot backends
orqenix backend status
orqenix backend switch sqlite
```

All commands accept `--json`, `--table` (default), or `--plain` for output formatting.

---

## Known limitations (Phase 6)

- **In-memory default adapters.** The four bin adapters (`audit-log-default.mjs`, `delegation-store-default.mjs`, `blast-radius-default.mjs`, `route-probe-default.mjs`) are lightweight in-memory implementations suitable for Phase 6 operator workflow validation. Persistent production adapters wired into the real `@orqenix/audit-log`, `@orqenix-pro/mesh-delegation`, and `@orqenix-pro/blast-radius` packages are deferred to the next Pro hardening pass.
- **Polyglot backend stub.** `@orqenix-pro/polyglot-backend` ships as a stub package exposing the `BackendManager` seam and operator CLI workflow required by G47-pro. Real schema-aware backend migration and production-grade backend switching are deferred to Phase 7.
- **Lazy native module load.** `mesh route` triggers loading of `@orqenix/mesh-routing` on first call. In environments without native build tools for `better-sqlite3` and `@mongodb-js/zstd`, only `mesh route` is affected; all other commands run normally.
- **`pnpm pack --dry-run` on pnpm 9.12**. Not supported on this pnpm version, hence release verification uses `npm pack packages/cli --dry-run` instead.
- **No npm publish from this script.** Tag and GitHub Release are automated by the release verification script; npm publish is a separate runbook that must run on a CI image with the required C++ build tools.

---

## Breaking changes

None. This is the first published version of `@orqenix-pro/cli`.

---

## Dependencies

Runtime:

- `@orqenix/mesh-transport-core` from OSS Phase 6 (peer dependency)
- `@orqenix/mesh-observability` from OSS Phase 6
- `@orqenix-pro/license` (workspace)
- `@orqenix-pro/mesh-delegation` (workspace, optional for default adapter path)
- `@orqenix-pro/blast-radius` (workspace, optional for default adapter path)
- `@orqenix-pro/polyglot-backend` (workspace stub)
- `@orqenix/mesh-routing` (workspace, lazy-loaded only by `mesh route`)

No `chalk`, `kleur`, `ansi-styles`, `yargs`, `commander`, or `oclif`.

---

## What's next

- **Persistent Pro adapters.** Replace the in-memory bin adapters with real `@orqenix/audit-log`, `@orqenix-pro/mesh-delegation`, and `@orqenix-pro/blast-radius` wiring in the next Pro release.
- **Phase 7 Cloud tier.** Multi-machine relay, browser libp2p, Web UI inspector, BYOK billing, and the optional Rust accelerator via NAPI-RS, all coordinated across the OSS and Pro tiers.
- **Pro CI publish runbook.** Separate runbook for `npm publish @orqenix-pro/cli` on a CI image with C++ build tools, including provenance and dist-tag policy.

---

## Acknowledgments

Pro Phase 6 was built across three delivery docs (D6.11A foundation, D6.11B mesh and delegation, D6.12 quota and backend), with two audit waves (D6P-F1, D6P-F2) catching package import drift and runtime / pack publication readiness before tag.

Verify the release on your machine before relying on it:

```bash
node --import tsx scripts/gates/verify-phase-6-pro.ts
# Must end with: ALL GATES PASS
```

---

*Pro Phase 6 closes. Phase 7 starts on a stable Pro foundation.*
