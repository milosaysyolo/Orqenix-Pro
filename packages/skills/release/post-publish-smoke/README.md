# post-publish-smoke

Verify published packages on npm after release. Checks npm view, install, and require.

## Usage

```typescript
import { run } from "post-publish-smoke";

const result = await run({
  packages: [{ name: "@orqenix/core", version: "0.5.0" }],
});
```
