# classify-changes

Read git log since ref and classify each commit per package using conventional commit format.

## Usage

```typescript
import { run } from "classify-changes";

const result = await run({
  sinceRef: "v0.4.0-phase-4",
  packageNames: ["@orqenix/core"],
  packagesPaths: ["packages/core"],
});
```

## Classification

- breaking: `!` suffix or `BREAKING CHANGE:` footer
- feat: `feat:` prefix
- fix: `fix:` prefix
- refactor, perf, test, docs, chore: matching conventional commit types
- unknown: does not match conventional commit pattern
