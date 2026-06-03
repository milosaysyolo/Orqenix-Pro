# append-audit-log

Append entry to release-audit.log with BLAKE3 hash chain. Tamper-evident, compatible with Phase 5 Part 12A audit-log.

## Usage

```typescript
import { run, verifyChain } from "append-audit-log";

const result = await run({
  logPath: ".orqenix/release-audit.log",
  entry: {
    timestamp: new Date().toISOString(),
    agent: "release-lead",
    action: "detect-changed-packages",
    inputs: { sinceRef: "v0.4.0" },
  },
});

// Verify chain integrity
const { valid, tamperedAt } = await verifyChain(logPath);
```

## Hash chain format

Each entry contains:
- All original fields
- `prev`: hash of previous entry (64 hex chars, `0x64` for genesis)
- `pos`: position in chain (1-based)
- `hash`: BLAKE3 hash of all other fields

## Tamper detection

`verifyChain()` replays all entries checking:
1. Correct `prev` reference
2. Correct `pos` sequence
3. Re-computed hash matches stored hash
