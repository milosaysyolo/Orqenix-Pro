# detect-changed-packages

Detect which packages have file changes since a given git ref.

## Usage

```typescript
import { run } from "detect-changed-packages";

const result = await run({ sinceRef: "v0.4.0-phase-4" });
console.log(result.changedPackages);
```

## Output

- `sinceRef`: the git ref used as baseline
- `totalChangedFiles`: number of changed files across all packages
- `changedPackages`: list of packages with file changes
