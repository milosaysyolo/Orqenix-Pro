# D6P-DEPS-FIX Implementation Report

**Date:** 2026-06-11T06:23:00Z
**Sprint:** C (forward-compatibility hot-patch)
**Approach:** P+ + Policy A + No provenance
**Tag:** v0.6.1-phase-6

## Why

CLI v0.6.0-phase-6 published with problematic dependency specifications:
- Caret-prerelease (`^0.6.0-phase-6`) on OSS mesh packages blocks Phase 7+ upgrade
- Wildcards (`"*"`) on `@orqenix/mesh-routing` and `@orqenix/audit-log` are dangerous
- Exact pins on Pro deps prevent patch updates

## What

| Action | Result |
|---|---|
| Republish 4 Pro deps with clean semver | PASS |
| Hot-patch CLI v0.6.0 to v0.6.1-phase-6 | PASS |
| CLI deps use caret semver, no wildcards (2 OSS mesh keep phase-tag per rule #8) | PASS |
| Live install smoke v0.6.1-phase-6 | PASS |
| Deprecate v0.6.0-phase-6 + 4 phase-tagged deps | PASS |
| GitHub Release v0.6.1-phase-6 | PASS |
| v0.6.0-phase-6 release marked deprecated | PASS |

## Published versions

| Package | New version | shasum |
|---|---|---|
| @orqenix-pro/license | 0.4.0 | 7f310f0f406c73549719fefe1c684582d3fada4d |
| @orqenix-pro/blast-radius | 0.5.0 | 340774ad9b05cd7ba4112590ff6cad3bd3dafa74 |
| @orqenix-pro/mesh-delegation | 0.5.0 | db627725a3aafb95a08f5bf8091118f713801318 |
| @orqenix-pro/polyglot-backend | 0.5.0 | f767581f756ed8e67ba4dac8721148c333c0daa3 |
| @orqenix-pro/cli | 0.6.1-phase-6 | 4e16a5b5bfa18240359b5e67115705c95640e22b |

## Published CLI dependencies (registry shape)

```
@orqenix/mesh-transport-core: ^0.6.0-phase-6  (phase-tag kept - no clean 0.6.0 on npm)
@orqenix/mesh-observability:   ^0.6.0-phase-6  (phase-tag kept - no clean 0.6.0 on npm)
@orqenix/mesh-routing:         ^0.5.0           (was *)
@orqenix/audit-log:            ^0.5.0           (was *)
@orqenix-pro/license:          ^0.4.0           (was 0.4.0-phase-4)
@orqenix-pro/blast-radius:     ^0.5.0           (was 0.5.0-phase-5)
@orqenix-pro/mesh-delegation:  ^0.5.0           (was 0.5.0-phase-5)
@orqenix-pro/polyglot-backend: ^0.5.0           (was 0.5.0-phase-5)
```

## Deprecated versions

| Package@Version | Replacement |
|---|---|
| @orqenix-pro/license@0.4.0-phase-4 | ^0.4.0 |
| @orqenix-pro/blast-radius@0.5.0-phase-5 | ^0.5.0 |
| @orqenix-pro/mesh-delegation@0.5.0-phase-5 | ^0.5.0 |
| @orqenix-pro/polyglot-backend@0.5.0-phase-5 | ^0.5.0 |
| @orqenix-pro/cli@0.6.0-phase-6 | ^0.6.1 |

## Future policy

Phase 7 forward: drop -phase-N tag from versions. Use clean semver `v0.7.0`, `v0.8.0`. Phase visibility moves to git tags and GitHub Release titles.

## Verification

```bash
npm install @orqenix-pro/cli@^0.6.1
orqenix help
```

Phase E smoke: help=0, auth=3, quota=3 PASS.

## Deviations from original spec

1. `@orqenix/mesh-transport-core` and `@orqenix/mesh-observability` kept at `^0.6.0-phase-6` because npm registry only has `0.6.0-phase-6` (no clean `0.6.0`). Cannot republish OSS per rule #8. Future OSS Phase 7 publish should make `0.6.0` available.
2. Lockfile overrides for sibling Orqenix repo packages were removed for these 2 packages due to corrupted `package.json` files (PowerShell serialization artifacts). These were restored to valid JSON (format fix only, no version change).

## Sign-off

- Agent: build agent (opencode)
- Operator: milosaysyolo (PROCEED received)
