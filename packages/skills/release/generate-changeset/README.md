# generate-changeset

Generate a Changesets-format `.md` file with frontmatter bumps and derived summary.

## Usage

```typescript
import { run } from "generate-changeset";

const result = await run({
  proposals,
  classifications,
  changesetDir: ".changeset",
});
```

## Output

Standard Changesets markdown file at `.changeset/<slug>-<random>.md`.
