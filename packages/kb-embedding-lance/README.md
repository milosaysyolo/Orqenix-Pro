# @orqenix-pro/kb-embedding-lance

Vector-native embedding KB backed by https://lancedb.com/ (Orqenix-Pro tier, BSL-1.1).

## Why LanceDB instead of sqlite-vec

| Property | sqlite-vec (OSS) | LanceDB (Pro) |
|----------|------------------|---------------|
| Up to 10K vectors | excellent | excellent |
| 10K to 1M vectors | OK | excellent (HNSW index) |
| Search latency | 5-50ms | 0.5-5ms |
| Disk format | SQLite blob | columnar Lance format |
| Sub-millisecond ANN | no | yes |

For codebases with >10K symbols or chat corpora >10K entries, swap to LanceDB.

## Cross-platform fallback

LanceDB has native bindings; tests use `InMemoryVectorDriver` so CI is portable.

## 3 distance metrics supported

`cosine` (default), `l2`, `dot`.

Charter gate: **G18-pro Polyglot Backend Conformance**.
