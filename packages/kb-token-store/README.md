# @orqenix-pro/kb-token-store

LMDB-backed token verifier cache (Orqenix-Pro tier, BSL-1.1).

## Why LMDB instead of in-process LRU

| Property | OSS in-process LRU | Pro LMDB |
|----------|---------------------|----------|
| Survives restarts | no | yes |
| Multi-process sharing | no | yes |
| Throughput | 100K ops/sec | 1M+ ops/sec |
| Disk format | n/a | LMDB B+ tree |

For multi-process deployments (CLI + daemon + mesh router sharing one scope), LMDB removes redundant signature verification across processes.

## API

```ts
import { TokenStore } from '@orqenix-pro/kb-token-store';
const store = new TokenStore({ dbPath: './.orqenix/token-cache' });
await store.open();
const cached = await store.get(jti);
if (!cached) {
  const v = await verifier.verify(token);
  await store.put(v);
}
await store.invalidate(jti);
await store.compact();
await store.close();
```

Charter gate: **G18-pro Polyglot Backend Conformance**.
