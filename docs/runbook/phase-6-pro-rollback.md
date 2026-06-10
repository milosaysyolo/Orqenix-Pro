# Orqenix Phase 6 Pro CLI Rollback Runbook

> **Audience:** operators running the Pro CLI alongside an OSS local-node.
> **When to use:** you want to disable Pro CLI access while keeping the OSS local-node running.
> **Property:** the Pro CLI is gated by a license token. Removing the token disables the CLI without touching the local-node or any data.

## 1. Pre-rollback checks

1. **Note the active backend** in case you need to revert later.
   ```bash
   orqenix backend status --json
   ```
2. **Snapshot the audit log** so any in-flight Pro mutations remain traceable.
   ```bash
   tar -czf orqenix-pro-audit-$(date -u +%Y%m%dT%H%M%SZ).tar.gz .orqenix/audit/
   ```

## 2. Soft rollback (recommended): revoke the license token

1. **Remove the license token** from the env and the config file.
   ```bash
   unset ORQENIX_PRO_LICENSE
   rm -f .orqenix/license.txt
   ```
2. **Verify the CLI now refuses Pro commands.**
   ```bash
   orqenix auth status
   # exit code 3, message: "Pro license required"
   ```
3. The OSS local-node continues to run unaffected. All Phase 6 OSS gates remain in force.

This rollback is reversible by restoring the license file.

## 3. Hard rollback: uninstall the Pro CLI binary

If you also need to remove the CLI binary from the system:

```bash
pnpm uninstall -g @orqenix-pro/cli
# or, if installed locally:
pnpm --filter @orqenix-pro/cli remove --all
```

The OSS `orqenix-node` binary is shipped from a different package
(`@orqenix/local-node`) and is unaffected.

## 4. Reverting an unwanted Pro mutation

The Pro CLI writes tamper-evident audit entries for every mutation
(`delegation.revoke`, `quota.set`, `quota.reset`, `backend.switch`). To revert
an unwanted change:

1. **Read the audit entry** to confirm the prior state.
   ```bash
   # The audit reader ships in @orqenix-pro/audit.
   pnpm --filter @orqenix-pro/audit run read --index <N>
   ```
2. **Apply the inverse operation** through the CLI (e.g., `backend switch <previous>`,
   `quota set <kind> --limit <previous>`). The reversal itself produces a new
   audit entry; the chain remains intact.
3. **Do NOT edit the audit log directly.** The hash chain is the integrity guarantee.

## 5. Anti-patterns

- **Do NOT delete `.orqenix/audit/`** unless you have intentionally archived it.
  Loss of audit history breaks the integrity guarantee.
- **Do NOT manually edit hash chains.** Use the CLI inverse operations.
- **Do NOT share the Pro license token** across operators. Issue separate tokens.
