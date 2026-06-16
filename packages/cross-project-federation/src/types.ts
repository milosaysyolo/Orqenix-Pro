// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/cross-project-federation , Type definitions

import { z } from 'zod';
import type { InstinctCandidate } from '@orqenix/self-learning-detection';

/** A candidate detected across multiple projects */
export interface CrossProjectCandidate {
  /** Shared pattern hash */
  patternHash: string;
  patternName: string;
  patternDescription: string;
  /** Projects where this pattern was observed */
  sourceProjects: Array<{
    projectId: string;
    projectName: string;
    occurrenceCount: number;
    successRate: number;
  }>;
  /** Aggregate impact across projects */
  aggregateImpact: number;
  /** Total occurrences across all source projects */
  totalOccurrences: number;
}

/** Per-project-pair federation approval (INV-18) */
export const FederationApprovalSchema = z.object({
  source_project_id: z.string(),
  target_project_id: z.string(),
  pattern_hash: z.string(),
  approved_by: z.string(),
  approved_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});

export type FederationApproval = z.infer<typeof FederationApprovalSchema>;

/** Result of approving a cross-project candidate */
export interface ApprovalResult {
  ok: boolean;
  candidatePatternHash: string;
  sharedToProject: string;
  /** Audit event ID */
  auditId?: string;
}
