# @orqenix-pro/blast-radius

Per-scope write quotas with windowed consumption tracking (Pro tier, BSL-1.1).

## 5 quota kinds

| Kind | Typical window | What it limits |
|------|---------------|----------------|
| `writes_per_hour` | 1 hour | Total KB writes per scope per hour |
| `writes_per_day` | 24 hours | Total KB writes per scope per day |
| `cross_scope_writes_per_hour` | 1 hour | Writes that traverse a scope link |
| `detach_per_day` | 24 hours | Detach operations (full + unlink) |
| `kb_bytes_per_day` | 24 hours | Total payload bytes written |

## API

```ts
import { BlastRadiusStore, QuotaExceededError } from '@orqenix-pro/blast-radius';

const br = new BlastRadiusStore({ conn, scopeId: MY_SCOPE, auditStore });
br.setQuota({ kind: 'writes_per_hour', limit: 1000, windowMs: 3600_000 });

try {
  br.consume('writes_per_hour', 1); // increments by 1
} catch (e) {
  if (e instanceof QuotaExceededError) {
    console.log('back off until', br.usage('writes_per_hour')?.windowStartedAt);
  }
}
```

Charter gate: **G37-pro Blast Radius Containment**.
