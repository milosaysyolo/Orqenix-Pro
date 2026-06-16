# @orqenix-pro/cross-project-federation

> Pro (BSL-1.1) cross-project learning federation for Orqenix.
> Phase 8 (D8.γ). Charter gate G69 (Cross-Scope Federation, 8 sub-criteria).
> Converts to Apache-2.0 on 2030-06-11.

## Mission

Detects instinct candidates that recur across MULTIPLE projects a user owns,
and surfaces them as cross-scope candidates. Per ADR-E-011 + INV-18:

> Cross-project candidates SHOW but NEVER SHARE without explicit approval.

## How it works

1. Scans candidates across opted-in projects (per `~/.orqenix/projects.yaml`)
2. Finds patterns recurring in ≥2 projects (via pattern_hash + semantic clustering)
3. Surfaces them in the Promoter UI tagged "from N projects"
4. Each cross-project promotion requires explicit per-project-pair approval

## Approval model (INV-18)

- Candidates appear with `cross_scope: true` + source project list
- Data does NOT cross project boundaries on detection
- User approves a candidate → it becomes available in the target project
- Approval recorded in `~/.orqenix/federation-approvals.yaml` + audit
  (`memory.promoted.project_to_cross_project`)

## License

BSL-1.1 → Apache-2.0 (4-year conversion). See ./LICENSE.
