# Pre-publish Checks Index

24 deterministic checks organized by category:

## A — Environment
| ID  | Severity | Check | Rationale |
|-----|----------|-------|-----------|
| C01 | blocking | Git tree clean | Uncommitted changes risk publishing inconsistent state |
| C02 | warning | On release branch | Publishing from feature branches is risky |
| C03 | blocking | Node >= 20.0.0 | Required by engines policy |
| C04 | blocking | pnpm >= 9.0.0 | Required for workspace protocol support |

## B — Auth
| ID  | Severity | Check | Rationale |
|-----|----------|-------|-----------|
| C05 | blocking | npm whoami succeeds | Must be authenticated to publish |
| C06 | warning | NPM_TOKEN not expired | Expired tokens cause mid-publish failures |
| C07 | warning | Org membership | Only org members can publish to @orqenix/* |

## C — Packages
| ID  | Severity | Check | Rationale |
|-----|----------|-------|-----------|
| C08 | blocking | package.json fields valid | Missing fields cause publish failure |
| C09 | blocking | Publishability confirmed | Prevent publishing internal/example packages |
| C10 | blocking | Cross-scope deps resolved | workspace:* must resolve when crossing scopes |
| C11 | warning | No orphan LICENSE files | Leftover files cause confusion |
| C12 | warning | README quality | Impacts npm discoverability |

## D — Build
| ID  | Severity | Check | Rationale |
|-----|----------|-------|-----------|
| C13 | blocking | dist/ present | Build must run before publish |
| C14 | blocking | .d.ts files exist | Required for TypeScript consumers |
| C15 | warning | Bundle size budget | Oversized bundles impact performance |
| C16 | blocking | Exports map resolvable | Missing export paths break consumers |

## E — Security
| ID  | Severity | Check | Rationale |
|-----|----------|-------|-----------|
| C17 | blocking | No secrets in tarball | Leaked secrets are permanent on npm |
| C18 | blocking | Forbidden files excluded | Policy-defined forbidden file list |
| C19 | warning | Dependency licenses allowed | Legal compliance |
| C20 | warning | No HIGH/CRITICAL CVE | Supply chain security |

## F — Release
| ID  | Severity | Check | Rationale |
|-----|----------|-------|-----------|
| C21 | blocking | Changeset present | Drives version bump and changelog |
| C22 | blocking | Version not on npm | npm forbids republishing same version |
| C23 | blocking | Version monotonic | Prevents accidental downgrades |
| C24 | blocking | Charter gates pass | Required gates must pass before publish |
