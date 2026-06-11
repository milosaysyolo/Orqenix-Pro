<!-- HEADER:START -->
<p align="center">
  <a href="https://orqenix.dev">
    <img src="./assets/logo-banner-pro.svg" alt="Orqenix-Pro" />
  </a>
</p>

<h1 align="center">Orqenix-Pro</h1>

<p align="center">
  <strong>Production-grade extensions for Orqenix.</strong>
</p>

<p align="center">
  LLM-based memory distillation, polyglot knowledge backends,<br/>
  mesh delegation chains, and blast-radius containment,<br/>
  all running on your machine, on top of the open-source Orqenix core.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@orqenix-pro/core"><img alt="npm" src="https://img.shields.io/npm/v/@orqenix-pro/core?logo=npm&label=%40orqenix-pro%2Fcore&color=7C3AED" /></a>
  <a href="https://github.com/milosaysyolo/Orqenix-Pro/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/milosaysyolo/Orqenix-Pro/ci.yml?branch=main&logo=github&label=CI" /></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-BSL--1.1-amber.svg?label=license&color=F59E0B" /></a>
  <a href="https://github.com/milosaysyolo/Orqenix"><img alt="built on Orqenix" src="https://img.shields.io/badge/built%20on-Orqenix%20OSS-success?logo=github" /></a>
  <a href="https://nodejs.org"><img alt="node" src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js" /></a>
</p>

<p align="center">
  <a href="https://github.com/milosaysyolo/Orqenix/discussions"><img alt="discussions" src="https://img.shields.io/github/discussions/milosaysyolo/Orqenix?logo=github&label=community" /></a>
  <a href="https://github.com/milosaysyolo/Orqenix-Pro/issues"><img alt="pro issues" src="https://img.shields.io/github/issues/milosaysyolo/Orqenix-Pro?logo=github&label=pro+issues" /></a>
  <a href="https://github.com/milosaysyolo/Orqenix-Pro/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/milosaysyolo/Orqenix-Pro?style=social" /></a>
  <a href="https://github.com/milosaysyolo/Orqenix-Pro/releases"><img alt="release" src="https://img.shields.io/github/v/release/milosaysyolo/Orqenix-Pro?include_prereleases&label=release" /></a>
</p>

<p align="center">
  <sub>
    ⚠️ Orqenix-Pro is licensed under <strong>Business Source License 1.1</strong>.
    Each released version automatically converts to Apache 2.0 four years after its release date.
    Read the full <a href="./LICENSE">LICENSE</a>, or jump to the
    <a href="#-license-faq">License FAQ</a>.
  </sub>
</p>

<p align="center">
  <a href="#%EF%B8%8F-license-at-a-glance">License at a glance</a> ,
  <a href="#-what-pro-adds">What Pro adds</a> ,
  <a href="#-oss-vs-pro">OSS vs Pro</a> ,
  <a href="#-quick-start">Quick Start</a> ,
  <a href="#-packages">Packages</a> ,
  <a href="#%EF%B8%8F-when-do-you-need-pro">When do you need Pro</a> ,
  <a href="#%EF%B8%8F-architecture-deltas">Architecture</a> ,
  <a href="#%EF%B8%8F-configuration-recipes">Recipes</a> ,
  <a href="#-license-faq">License FAQ</a> ,
  <a href="#-commercial-inquiries">Commercial</a>
</p>

<hr/>
<!-- HEADER:END -->

## ⚖️ License at a glance

> Plain-English summary, not legal advice. The authoritative terms live in [`./LICENSE`](./LICENSE).

- ✅ **You may use Orqenix-Pro freely in production**, including inside paid products you ship to customers. Internal tools, SaaS backends, agencies, regulated enterprises, all fine.
- ❌ **You may not offer Orqenix-Pro itself as a hosted or managed service** to third parties during the 4-year BSL window. Building your own product *with* Orqenix-Pro inside is fine. Reselling Orqenix-Pro *as* the product is not.
- ⏳ **Each released version auto-converts to Apache 2.0** four years after its release date. `v0.5.0` (released 2026-06-03) converts on **2030-06-03**. Future versions carry their own Change Date.

If your case does not fit either lane, see [Commercial inquiries](#-commercial-inquiries).

<hr/>

## ✨ What Pro adds

Orqenix-Pro is a **set of opt-in augmentations** that slot into the existing Orqenix architecture. You install the open-source Orqenix core first, then add the Pro packages you actually need. There is no Pro-only fork of the core.

| Capability | Package | Why it matters |
|---|---|---|
| 🧠 **LLM-based Memory Distiller** | [`@orqenix-pro/memory-distiller-llm`](./packages/memory-distiller-llm) | Higher-quality semantic compression than the OSS heuristic distiller, with adaptive BYOK providers (GPT-4o-mini, Claude Haiku, Gemini Flash, DeepSeek V3). |
| 🕸️ **Mesh Delegation Chains** | [`@orqenix-pro/mesh-delegation`](./packages/mesh-delegation) | Multi-hop capability delegation up to depth 8 with cap narrowing, remaining-hops enforcement, and provenance tagging. |
| 💥 **Blast Radius Containment** | [`@orqenix-pro/blast-radius`](./packages/blast-radius) | Quota-based containment across 5 quota kinds (queries, tokens, bytes, delegations, mutations) with windowed tracking. |
| 🗂️ **Polyglot Knowledge Backends** | [`kb-code-graph`](./packages/kb-code-graph), [`kb-embedding-lance`](./packages/kb-embedding-lance), [`kb-token-store`](./packages/kb-token-store) | Kuzu for the code graph, LanceDB for embeddings, LMDB for the token store. Drop-in adapters that share the OSS contract. |
| 🔁 **Pro Migration Tooling** | [`@orqenix-pro/pro-migration`](./packages/pro-migration) | Reserved migration IDs 100 to 199, safe upgrades for OSS → Pro adapter swaps, per-KB rollback inside a 7-day window. |

<hr/>

## 📊 OSS vs Pro

> Pro is not "better OSS". Pro is **for different workload sizes and operational needs**. Pick by workload fit.

| Area | Orqenix (OSS, Apache 2.0) | Orqenix-Pro (BSL 1.1) |
|---|---|---|
| **License** | Apache 2.0 | BSL 1.1, converts to Apache 2.0 after 4 years |
| **Scope identity** | ✅ Ed25519 + BLAKE3 scope_id | uses OSS |
| **Local mesh, capability tokens** | ✅ Direct links, depth 1 | ✅ Direct links + delegation chains depth 1 to 8 with cap narrowing |
| **Capability verify latency** | ✅ p95 < 10 ms (SQLite token store) | ✅ p95 < 1 ms (LMDB token store) |
| **CodeKB** | ✅ SQLite + sqlite-vec | ✅ + Kuzu graph for multi-hop queries |
| **Embeddings** | ✅ sqlite-vec, recommended up to 50K vectors | ✅ + LanceDB ANN, scales to millions of vectors |
| **ChatKB + diff-only storage** | ✅ Full | uses OSS |
| **Memory distiller** | ✅ Heuristic, deterministic, offline | ✅ + LLM-based, BYOK, with fallback to heuristic |
| **Blast radius** | ❌ Not enforced | ✅ 5 quota kinds, windowed, per-link override |
| **Provenance tagging** | ✅ Per scope | ✅ Per scope + per delegation hop |
| **Audit log (BLAKE3, tamper-evident)** | ✅ | uses OSS |
| **Migration IDs** | 1 to 99 | 100 to 199 |
| **Recommended for** | Solo devs, small teams, repos under 100K files | Large monorepos, multi-team, regulated environments |

If none of the Pro rows describe your problem yet, OSS is the right answer. You can upgrade later, per KB, without data migration risk.

<hr/>

## 🚀 Quick Start

Pro requires Orqenix OSS. Install both:

```bash
pnpm add @orqenix/core @orqenix/cli
pnpm add @orqenix-pro/core
```

Add Pro packages a-la-carte, only what you need:

```bash
# LLM distiller (requires API key for your chosen provider)
pnpm add @orqenix-pro/memory-distiller-llm

# Polyglot backends
pnpm add @orqenix-pro/kb-token-store     # LMDB-backed token cache
pnpm add @orqenix-pro/kb-code-graph      # Kuzu graph DB
pnpm add @orqenix-pro/kb-embedding-lance # LanceDB ANN index

# Mesh + safety
pnpm add @orqenix-pro/mesh-delegation
pnpm add @orqenix-pro/blast-radius
```

Install the Pro CLI globally (requires a Pro license token):

```bash
npm install -g @orqenix-pro/cli@^0.6.1
```

Upgrade your existing scope to Pro tier:

```bash
orqenix scope upgrade --tier pro
```

This writes `tier: pro` into `.orqenix/scope.yaml` and runs the Pro migration set (IDs 100 to 199). It does **not** move any data. OSS adapters keep serving every KB until you explicitly opt into a Pro adapter, per KB.

Verify:

```bash
orqenix scope info
# tier: pro
# adapters available: sqlite, lmdb, kuzu, lancedb
# adapters active:    sqlite (all KBs)
```

Need a deeper guide? Read [`docs/migration-from-oss.md`](./docs/migration-from-oss.md).

<hr/>

## 📦 Packages

| Package | Version | Purpose | Migration ID |
|---|---|---|---|
| [`@orqenix-pro/core`](./packages/core) | `0.5.0-phase-5` | Pro entry point, re-exports curated surface | , |
| [`@orqenix-pro/kb-code-graph`](./packages/kb-code-graph) | `0.5.0-phase-5` | Kuzu graph DB adapter for CodeKB | 100 |
| [`@orqenix-pro/kb-embedding-lance`](./packages/kb-embedding-lance) | `0.5.0-phase-5` | LanceDB ANN adapter for embeddings | 110 |
| [`@orqenix-pro/kb-token-store`](./packages/kb-token-store) | `0.5.0-phase-5` | LMDB-backed capability token cache | 120 |
| [`@orqenix-pro/memory-distiller-llm`](./packages/memory-distiller-llm) | `0.5.0-phase-5` | LLM distiller, adaptive BYOK provider router | 130 |
| [`@orqenix-pro/mesh-delegation`](./packages/mesh-delegation) | `0.5.0-phase-5` | Multi-hop delegation chains, cap narrowing | 140 |
| [`@orqenix-pro/blast-radius`](./packages/blast-radius) | `0.5.0-phase-5` | Quota-based containment, 5 quota kinds | 150 |
| [`@orqenix-pro/pro-migration`](./packages/pro-migration) | `0.5.0-phase-5` | Migration runner for Pro IDs 100 to 199 | , |

Full charter gate matrix lives in [`docs/charter-gates.md`](./docs/charter-gates.md).

<hr/>

## 🎚️ When do you need Pro

Use these signals to decide. If none apply, OSS is the right answer.

| Signal | Why Pro helps |
|---|---|
| Your monorepo has over 100K files, or over 1M embeddings | LanceDB + Kuzu scale where SQLite + sqlite-vec do not |
| You delegate capabilities across more than two scopes | OSS supports direct links only; delegation chains live in Pro |
| You need per-scope quotas and tenant isolation | Blast Radius enforces them at the kernel level |
| You want the highest-quality semantic compression | LLM distiller materially outperforms heuristics on natural-language KBs |
| Your security review requires auditable capability lifetimes | Pro token store ships sub-millisecond verify with TTL and revocation |
| You serve multiple teams from one Orqenix install | Per-link blast-radius and delegation make tenancy explicit |

If you are unsure, run with OSS first. The migration path is documented, per-KB, and reversible inside a 7-day rollback window.

<hr/>

## 🏗️ Architecture deltas

Pro slots into the same 6-layer architecture as OSS. The diagram below highlights only the Pro-specific surfaces. Everything else is OSS, unchanged.

```
┌──────────────────────────────────────────────────────────┐
│ L6  Application (agents, CLI, editors)                   │
├──────────────────────────────────────────────────────────┤
│ L5  Memory                                               │
│     ┌──────────────────────────────┐                     │
│     │ memory-distiller-llm (Pro)   │  ◄── BYOK provider  │
│     └──────────────────────────────┘                     │
├──────────────────────────────────────────────────────────┤
│ L4  Mesh + Identity                                      │
│     ┌──────────────────────────────┐                     │
│     │ mesh-delegation (Pro)        │  ◄── depth 1 to 8   │
│     │ blast-radius   (Pro)         │  ◄── 5 quota kinds  │
│     └──────────────────────────────┘                     │
├──────────────────────────────────────────────────────────┤
│ L3  Knowledge (4 KBs, adapter-driven)                    │
├──────────────────────────────────────────────────────────┤
│ L2  Storage                                              │
│     ┌──────────────────────────────────┐                 │
│     │ kb-code-graph      (Kuzu,  Pro)  │                 │
│     │ kb-embedding-lance (Lance, Pro)  │                 │
│     │ kb-token-store     (LMDB,  Pro)  │                 │
│     └──────────────────────────────────┘                 │
├──────────────────────────────────────────────────────────┤
│ L1  Platform (Node, native bindings, fs)                 │
└──────────────────────────────────────────────────────────┘
```

Deep dives:

- [`docs/architecture/delegation.md`](./docs/architecture/delegation.md)
- [`docs/architecture/blast-radius.md`](./docs/architecture/blast-radius.md)
- [`docs/architecture/polyglot-backends.md`](./docs/architecture/polyglot-backends.md)
- [`docs/architecture/llm-distiller.md`](./docs/architecture/llm-distiller.md)

<hr/>

## 🛠️ Configuration recipes

### Recipe 1, enable LLM distillation with Claude Haiku

```yaml
# .orqenix/scope.yaml
tier: pro
distiller:
  driver: llm
  provider: anthropic
  model: claude-haiku-4
  budget:
    tokens_per_day: 200000
    fallback_to_heuristic: true
```

```bash
export ANTHROPIC_API_KEY=sk-ant-...
orqenix distill run --tier semantic
```

### Recipe 2, polyglot upgrade for a large monorepo

```bash
# Migrate one KB at a time, parity-checked, atomically flipped
orqenix kb migrate code-graph  --to kuzu
orqenix kb migrate embeddings  --to lancedb
orqenix kb migrate tokens      --to lmdb
```

Old SQLite files are preserved for 7 days inside the rollback window. Roll back with `orqenix kb rollback <name>`.

### Recipe 3, cap a noisy linked scope

```bash
orqenix blast-radius set --link <scope-id> \
  --queries-per-hour 500 \
  --tokens-per-day 1_000_000 \
  --delegations-max 0
```

More recipes live in [`docs/recipes/`](./docs/recipes/).

<hr/>

## 🔐 License FAQ

**Q: Can I use Orqenix-Pro inside a SaaS product I sell to customers?**
Yes. Selling a product *built with* Orqenix-Pro is fine. The only restricted use case is offering Orqenix-Pro itself as a hosted service.

**Q: Can I use Orqenix-Pro in an internal enterprise deployment?**
Yes, unconditionally.

**Q: Can I fork Orqenix-Pro?**
You can read, copy, modify, and run the source under BSL 1.1 with the same hosting restriction. After the Change Date (4 years from each release), each released version becomes Apache 2.0 and may be forked under those terms.

**Q: What is the Change Date for `v0.5.0`?**
**2030-06-03.** Newer versions ship with their own Change Date in [`./LICENSE`](./LICENSE).

**Q: Does BSL 1.1 affect my OSS code that depends on Pro?**
No. Your code is yours under whatever license you choose. The BSL 1.1 obligation is on how *Orqenix-Pro itself* is distributed, not on your application that consumes it.

**Q: I need different terms (OEM, embedded, regulated industry, or hosted service rights).**
See [Commercial inquiries](#-commercial-inquiries).

<hr/>

## 💼 Commercial inquiries

For commercial licenses, OEM agreements, priority support, or terms outside BSL 1.1:

📧 `licensing@orqenix.dev`

Please include:

- Company and use case, one paragraph
- Deployment shape (self-host, embedded, hosted service for third parties, etc.)
- Approximate scope size (number of repositories, users, events per day)

We typically respond within 5 business days.

<hr/>

## 🤝 Community

Community lives in the **open-source repo** so OSS and Pro users meet in one place:

- 💬 [GitHub Discussions](https://github.com/milosaysyolo/Orqenix/discussions), the primary forum
- 📌 [Announcements + waitlists for Discord and Twitter](https://github.com/milosaysyolo/Orqenix/discussions/categories/announcements)
- 🐛 Bugs for **Pro** packages, [open an issue here](https://github.com/milosaysyolo/Orqenix-Pro/issues)
- 🐛 Bugs for **OSS** packages, [open them in the OSS repo](https://github.com/milosaysyolo/Orqenix/issues)
- 🔐 Security disclosures, please follow [`./SECURITY.md`](./SECURITY.md)
- 📜 License questions, use the [License question issue template](./.github/ISSUE_TEMPLATE/license_question.yml)

By participating, you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

<hr/>

## 🙏 Acknowledgements

Orqenix-Pro stands on the shoulders of the open-source teams behind
[`kuzu`](https://kuzudb.com/),
[`lancedb`](https://lancedb.com/),
[`lmdb-js`](https://github.com/kriszyp/lmdb-js),
the broader AI agent ecosystem (MCP, OpenCode, Claude Code, CrewAI, LangGraph),
and of course the [Orqenix OSS](https://github.com/milosaysyolo/Orqenix) core that everything here augments.

<hr/>

## 📄 License

- **License**: Business Source License 1.1, see [`./LICENSE`](./LICENSE).
- **Change License**: Apache License 2.0.
- **Change Date**: 4 years after the release date of each version. `v0.5.0` converts on **2030-06-03**.

The 3-tier model (OSS, Pro, Cloud) and the anti-paywall promises live in [`docs/licensing.md`](https://github.com/milosaysyolo/Orqenix/blob/main/docs/licensing.md) in the OSS repo.

<!-- FOOTER:START -->
<hr/>

<p align="center">
  Made with care by <a href="https://github.com/milosaysyolo">Milo</a> and contributors,
  in Ho Chi Minh City.
</p>
<p align="center">
  <a href="https://github.com/milosaysyolo/Orqenix">Orqenix</a> ,
  <a href="https://github.com/milosaysyolo/Orqenix-Pro">Orqenix-Pro</a> ,
  <a href="https://orqenix.dev">orqenix.dev</a>
</p>
<p align="center">
  <sub>
    Orqenix-Pro is an independent project, not affiliated with any employer of its maintainers.
    The Orqenix brand and logo are property of the project maintainers.
  </sub>
</p>
<!-- FOOTER:END -->
