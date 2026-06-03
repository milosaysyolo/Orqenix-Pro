# propose-bump

Apply semver rules from release-policy.yaml to propose bump type per package.

## Usage

```typescript
import { run } from "propose-bump";

const proposals = await run({
  classifications,
  policyPath: ".orqenix/release-policy.yaml",
});
```

## Bump mapping

| Change kind | Bump   |
| ----------- | ------ |
| breaking    | major  |
| feat        | minor  |
| fix         | patch  |
| refactor    | patch  |
| perf        | patch  |
| test        | none   |
| docs        | none   |
| chore       | none   |
| unknown     | none   |

## Fixed version groups

If `release-policy.yaml` defines `fixed_version_group`, all packages matching the pattern (e.g., `@orqenix/*`) bump together to the highest required bump.
