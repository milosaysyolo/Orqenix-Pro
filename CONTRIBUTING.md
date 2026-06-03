## Releasing

### For contributors

1. Add a changeset to your PR:
   ```bash
   pnpm changeset
   ```
2. Commit the generated `.md` file along with your code.
3. Submit your PR.

### For maintainers

Releases are fully automated. To trigger a release:

```bash
# Local CLI (when available)
orqenix release propose --bump minor

# Or comment on any GitHub issue
/orqenix release minor
```

The `release-lead` agent will:
1. Detect changed packages since last tag
2. Generate changesets
3. Open a "Version Packages" PR
4. Wait for human approval

After you merge the PR, CI will:
1. Build all packages
2. Run charter gates
3. Publish to npm with SLSA provenance
4. Tag the release as `vX.Y.Z-phase-N`
5. Run smoke test on published packages

Manual `npm publish` is disabled. All publishes must go through CI.

### Emergency procedures

See `.orqenix-pro/release-policy.yaml` and `docs/operator-guide/incident-response.md`.
