# create-release-branch

Create a `release/*` branch from current HEAD, commit the changeset.

## Usage

```typescript
import { run } from "create-release-branch";

const result = await run({
  version: "0.5.0",
  phaseNumber: 5,
  changesetPath: ".changeset/xxx.md",
});
```

## Naming convention

- With phase: `release/v0.5.0-phase-5`
- Without phase: `release/v0.5.0`
