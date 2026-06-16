// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/cross-project-federation , Federation service (facade)

import { CrossProjectDetector, type ProjectCandidates } from './cross-project-detector';
import { CrossProjectApprover, type FederationAuditWriter } from './cross-project-approver';
import type { CrossProjectCandidate, ApprovalResult } from './types';

export interface FederationServiceOptions {
  approvalsPath?: string;
  audit?: FederationAuditWriter;
}

/**
 * Top-level cross-project federation facade. Detects cross-project candidates +
 * manages approvals. Per ADR-E-011 + INV-18: show but never share without approval.
 */
export class FederationService {
  private readonly detector = new CrossProjectDetector();
  private readonly approver: CrossProjectApprover;

  constructor(options: FederationServiceOptions = {}) {
    this.approver = new CrossProjectApprover({
      ...(options.approvalsPath ? { approvalsPath: options.approvalsPath } : {}),
      ...(options.audit ? { audit: options.audit } : {}),
    });
  }

  /** Detects cross-project candidates (metadata only, no data sharing) */
  detectCrossProject(projects: ProjectCandidates[]): CrossProjectCandidate[] {
    return this.detector.detect(projects);
  }

  /** Approves sharing a cross-project candidate (the only sharing path) */
  approve(input: {
    sourceProjectId: string;
    targetProjectId: string;
    patternHash: string;
    approvedBy: string;
  }): Promise<ApprovalResult> {
    return this.approver.approve(input);
  }

  /** Checks approval status */
  isApproved(input: {
    sourceProjectId: string;
    targetProjectId: string;
    patternHash: string;
  }): Promise<boolean> {
    return this.approver.isApproved(input);
  }

  getApprover(): CrossProjectApprover {
    return this.approver;
  }
}
