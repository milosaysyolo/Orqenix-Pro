// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/cross-project-federation , Public API surface

export { CrossProjectDetector } from './cross-project-detector';
export type { ProjectCandidates } from './cross-project-detector';

export {
  CrossProjectApprover,
  NoopFederationAuditWriter,
} from './cross-project-approver';
export type {
  CrossProjectApproverOptions,
  FederationAuditWriter,
} from './cross-project-approver';

export type {
  CrossProjectCandidate,
  FederationApproval,
  ApprovalResult,
} from './types';

export { FederationApprovalSchema } from './types';
