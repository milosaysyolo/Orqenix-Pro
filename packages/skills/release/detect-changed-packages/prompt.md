# detect-changed-packages

Find changed packages since a git ref. Groups file changes by package directory.

## Input
- sinceRef: git ref (tag or commit)
- packagesGlob: glob pattern (default: "packages/*")

## Output
List of packages with file changes, counts, and file paths.
