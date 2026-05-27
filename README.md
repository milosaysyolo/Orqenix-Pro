# Orqenix-Pro

Commercial tier of Orqenix. License: BSL 1.1, converts to Apache 2.0 on 2030-01-01.

## Packages
- `@orqenix-pro/license` – Ed25519 signing + verification with 7-day grace period
- `@orqenix-pro/learning-loop` – continuous learning (observer + promoter + verification)
- `@orqenix-pro/knowledge-intel` – hybrid ranking + decision graph traversal

## Setup
```bash
pnpm install
pnpm generate-test-keys   # one-time, generates Ed25519 keypair in keys/
pnpm build
pnpm test
pnpm test:license-grace   # G19 charter target
```

## Cross-reference

See `Orqenix/docs/architecture/phase-4/license-gating.md` for design rationale.
