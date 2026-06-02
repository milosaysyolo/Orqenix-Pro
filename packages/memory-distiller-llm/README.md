# @orqenix-pro/memory-distiller-llm

LLM-based memory distiller (Orqenix-Pro tier, BSL-1.1).

## Differences from OSS heuristic distiller

| Property | OSS heuristic | Pro LLM |
|----------|---------------|---------|
| Extraction | regex patterns | LLM-based, 13 types |
| Verification | none | 2-pass critic by default |
| Pro-only types | n/a | `decision_rationale`, `code_pattern`, `anti_pattern`, `dependency_rule`, `troubleshooting` |
| Cost | free, ~1ms/entry | LLM tokens, ~500ms-2s/entry |
| Recall | ~60% | ~90%+ (depends on model) |
| Precision | varies | high (verification filters hallucinations) |

## How Pro-only types flow through OSS storage

The OSS `MemoryTierStore` only knows about 8 types. The Pro distiller maps the 5 extra types into the closest OSS type for storage but preserves the original `proType` in `metadata.proType` so query-time fidelity is intact.

| Pro type | Stored as OSS type |
|----------|--------------------|
| `decision_rationale` | `decision` |
| `code_pattern` | `skill` |
| `anti_pattern` | `learning` |
| `dependency_rule` | `fact` |
| `troubleshooting` | `skill` |

## Quick start

```ts
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { ChatStore, CHAT_KB_MIGRATIONS } from '@orqenix/kb-chat';
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from '@orqenix/memory-tiers';
import { OllamaAdapter } from '@orqenix/llm-adapter-ollama';
import { LlmDistiller } from '@orqenix-pro/memory-distiller-llm';

const conn = new SqliteConnection({ path: './kb.sqlite' });
runMigrations(conn, [...CHAT_KB_MIGRATIONS, ...MEMORY_TIER_MIGRATIONS]);

const distiller = new LlmDistiller({
  memStore: new MemoryTierStore({ conn, scopeId: MY_SCOPE }),
  chatConn: conn,
  adapter: new OllamaAdapter({ model: 'qwen2.5:7b' }),
  scopeId: MY_SCOPE,
  config: { verificationPasses: 2, minConfidence: 0.75 },
});

const stats = await distiller.distillBatch();
console.log(`LLM calls: ${stats.llmCallsTotal}, memories: ${stats.memoriesCreated}`);
```

Charter gate: **G6-pro LLM Distiller Behavior**.
