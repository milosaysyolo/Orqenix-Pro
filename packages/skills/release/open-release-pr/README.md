# open-release-pr

Push release branch to origin and open a GitHub PR via `gh` CLI.

## Usage

```typescript
import { run } from "open-release-pr";

const result = await run({
  branchName: "release/v0.5.0-phase-5",
  version: "0.5.0",
  proposals,
  verdict: "go",
  reason: "v0.5.0 Phase 5 release",
});
```

## PR body

Auto-generated with checklist, change table, and audit reference.
