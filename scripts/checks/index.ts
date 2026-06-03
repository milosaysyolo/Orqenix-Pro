import type { Check } from "./types";
import { C01_GitTreeClean } from "./category-A-environment/C01-git-tree-clean";
import { C02_OnReleaseBranch } from "./category-A-environment/C02-on-release-branch";
import { C03_NodeVersion } from "./category-A-environment/C03-node-version";
import { C04_PnpmVersion } from "./category-A-environment/C04-pnpm-version";
import { C05_NpmAuth } from "./category-B-auth/C05-npm-auth";
import { C06_NpmTokenNotExpired } from "./category-B-auth/C06-npm-token-not-expired";
import { C07_OrgMembership } from "./category-B-auth/C07-org-membership";
import { C08_PackageMetadataValid } from "./category-C-packages/C08-package-metadata-valid";
import { C09_PublishabilityConfirmed } from "./category-C-packages/C09-publishability-confirmed";
import { C10_CrossScopeDepsResolved } from "./category-C-packages/C10-cross-scope-deps-resolved";
import { C11_OrphanFilesDetected } from "./category-C-packages/C11-orphan-files-detected";
import { C12_ReadmeContentQuality } from "./category-C-packages/C12-readme-content-quality";
import { C13_BuildArtifactsPresent } from "./category-D-build/C13-build-artifacts-present";
import { C14_TypescriptDeclarations } from "./category-D-build/C14-typescript-declarations";
import { C15_BundleSizeBudget } from "./category-D-build/C15-bundle-size-budget";
import { C16_ExportsMapResolvable } from "./category-D-build/C16-exports-map-resolvable";
import { C17_NoSecretInTarball } from "./category-E-security/C17-no-secret-in-tarball";
import { C18_ForbiddenFilesExcluded } from "./category-E-security/C18-forbidden-files-excluded";
import { C19_DependencyLicensesAllowed } from "./category-E-security/C19-dependency-licenses-allowed";
import { C20_CveScan } from "./category-E-security/C20-cve-scan";
import { C21_ChangesetPresent } from "./category-F-release/C21-changeset-present";
import { C22_VersionNotPublished } from "./category-F-release/C22-version-not-published";
import { C23_VersionMonotonic } from "./category-F-release/C23-version-monotonic";
import { C24_CharterGatesPass } from "./category-F-release/C24-charter-gates-pass";

export const allChecks: Check[] = [
  C01_GitTreeClean,
  C02_OnReleaseBranch,
  C03_NodeVersion,
  C04_PnpmVersion,
  C05_NpmAuth,
  C06_NpmTokenNotExpired,
  C07_OrgMembership,
  C08_PackageMetadataValid,
  C09_PublishabilityConfirmed,
  C10_CrossScopeDepsResolved,
  C11_OrphanFilesDetected,
  C12_ReadmeContentQuality,
  C13_BuildArtifactsPresent,
  C14_TypescriptDeclarations,
  C15_BundleSizeBudget,
  C16_ExportsMapResolvable,
  C17_NoSecretInTarball,
  C18_ForbiddenFilesExcluded,
  C19_DependencyLicensesAllowed,
  C20_CveScan,
  C21_ChangesetPresent,
  C22_VersionNotPublished,
  C23_VersionMonotonic,
  C24_CharterGatesPass,
];
