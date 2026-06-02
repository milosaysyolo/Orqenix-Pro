# Orqenix-Pro

The Pro tier of the Orqenix local-first knowledge mesh.

## License

Business Source License 1.1 (BUSL-1.1) with a 4-year change date to Apache 2.0.
See ./LICENSE.

## Relation to the OSS repo

This repo extends https://github.com/orqenix/orqenix with:

| Package | Replaces / extends |
|---------|---------------------|
| `@orqenix-pro/kb-code-graph` | Code-aware graph KB (Kuzu) extending `@orqenix/storage-sqlite` adapter contract |
| `@orqenix-pro/kb-embedding-lance` | Vector-native embedding KB (LanceDB) extending `@orqenix/storage-sqlite` vec helpers |
| `@orqenix-pro/kb-token-store` | High-throughput token cache (LMDB) extending `@orqenix/capability-tokens` verifier cache |
| `@orqenix-pro/memory-distiller-llm` | LLM-based distiller extending `@orqenix/memory-distiller` heuristic OSS pipeline |
| `@orqenix-pro/mesh-delegation` | Multi-hop mesh delegation extending `@orqenix/mesh-routing` |
| `@orqenix-pro/blast-radius` | Blast-radius controls extending `@orqenix/detach` safety model |

## Charter Gates (Pro tier)

| Gate | Title |
|------|-------|
| G6-pro | LLM Distiller Behavior |
| G18-pro | Polyglot Backend Conformance |
| G36-pro | Mesh Delegation Chain |
| G37-pro | Blast Radius Containment |

All Pro charter gates depend on at least one OSS charter gate.
