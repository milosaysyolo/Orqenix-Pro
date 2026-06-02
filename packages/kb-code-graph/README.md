# @orqenix-pro/kb-code-graph

Code-aware graph KB backed by https://kuzudb.com/ (Orqenix-Pro tier, BSL-1.1).

## What it stores

- **Symbols** — functions, classes, methods, types, variables, modules
- **Edges** — calls, imports, extends, implements, references, declares

## Why graph and not SQL

Multi-hop queries like "what depends on function F, transitively, up to depth 3" are O(1) per hop with a graph DB and O(joins^depth) with SQL. For codebases >50K LOC this matters.

## Cross-platform fallback

Native Kuzu requires a platform-specific build. To keep tests + CI portable, the adapter falls back to `InMemoryGraphDriver` when Kuzu cannot be loaded. Production deployments should pin Kuzu via npm.

Charter gate: **G18-pro Polyglot Backend Conformance**.
