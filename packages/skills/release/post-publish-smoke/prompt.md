# post-publish-smoke

Verify published packages on npm.

## Input
- packages: array of { name, version }
- smokeTestCode: optional custom require test

## Output
Per-package results: npm view, install, require check.
