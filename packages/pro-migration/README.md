# @orqenix-pro/pro-migration

Migration tool from OSS backends (SQLite-only) to Pro polyglot backends (Kuzu + LanceDB + LMDB), with round-trip verification.

## API

```ts
import { migrateCodeGraph, migrateEmbeddings, migrateTokenStore } from '@orqenix-pro/pro-migration';

const report = await migrateCodeGraph({ symbols, edges, target: kuzuAdapter, scopeId });
console.log(`Migrated ${report.itemsMigrated} items in ${report.durationMs}ms`);
```

Verification compares count(target) vs count(source) and throws `ProMigrationVerificationError` on drift.

Charter gate: **G18-pro Polyglot Backend Conformance**.
