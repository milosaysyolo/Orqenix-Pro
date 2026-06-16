// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/cross-project-federation , Cross-project approver
//
// Manages per-project-pair approvals. Per ADR-E-011 + INV-18: data crosses
// project boundaries ONLY after explicit user approval.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import {
  FederationApprovalSchema,
  type FederationApproval,
  type ApprovalResult,
} from './types';

/** Audit writer for cross-project federation */
export interface FederationAuditWriter {
  append(event: {
    kind: 'memory.promoted.project_to_cross_project';
    ts: string;
    actor: { user: string };
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export class NoopFederationAuditWriter implements FederationAuditWriter {
  async append(): Promise<void> {
    // no-op
  }
}

export interface CrossProjectApproverOptions {
  approvalsPath?: string;
  audit?: FederationAuditWriter;
}

export class CrossProjectApprover {
  private readonly approvalsPath: string;
  private readonly audit: FederationAuditWriter;

  constructor(options: CrossProjectApproverOptions = {}) {
    this.approvalsPath =
      options.approvalsPath ?? join(homedir(), '.orqenix', 'federation-approvals.yaml');
    this.audit = options.audit ?? new NoopFederationAuditWriter();
  }

  /**
   * Approves sharing a cross-project candidate from source → target project.
   *
   * INV-18: this is the ONLY path by which a cross-project pattern is shared.
   * Records the approval + audits in BOTH source and target context.
   */
  async approve(input: {
    sourceProjectId: string;
    targetProjectId: string;
    patternHash: string;
    approvedBy: string;
    expiresAtIso?: string;
  }): Promise<ApprovalResult> {
    const now = new Date();
    const expires =
      input.expiresAtIso ??
      new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString();

    const approval: FederationApproval = {
      source_project_id: input.sourceProjectId,
      target_project_id: input.targetProjectId,
      pattern_hash: input.patternHash,
      approved_by: input.approvedBy,
      approved_at: now.toISOString(),
      expires_at: expires,
    };

    await this.persist(approval);

    // Audit in both projects (per CR v8.0 Section 4.5 cross-project promotion)
    await this.audit.append({
      kind: 'memory.promoted.project_to_cross_project',
      ts: now.toISOString(),
      actor: { user: input.approvedBy },
      payload: {
        source_project_id: input.sourceProjectId,
        target_project_id: input.targetProjectId,
        pattern_hash: input.patternHash,
        expires_at: expires,
      },
    });

    return {
      ok: true,
      candidatePatternHash: input.patternHash,
      sharedToProject: input.targetProjectId,
    };
  }

  /** Checks whether a cross-project share is approved + not expired */
  async isApproved(input: {
    sourceProjectId: string;
    targetProjectId: string;
    patternHash: string;
  }): Promise<boolean> {
    const approvals = await this.load();
    const now = new Date().toISOString();
    return approvals.some(
      (a) =>
        a.source_project_id === input.sourceProjectId &&
        a.target_project_id === input.targetProjectId &&
        a.pattern_hash === input.patternHash &&
        a.expires_at > now
    );
  }

  /** Lists all approvals */
  async list(): Promise<FederationApproval[]> {
    return this.load();
  }

  /** Revokes an approval */
  async revoke(input: {
    sourceProjectId: string;
    targetProjectId: string;
    patternHash: string;
  }): Promise<void> {
    const approvals = await this.load();
    const filtered = approvals.filter(
      (a) =>
        !(
          a.source_project_id === input.sourceProjectId &&
          a.target_project_id === input.targetProjectId &&
          a.pattern_hash === input.patternHash
        )
    );
    await this.writeAll(filtered);
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private async load(): Promise<FederationApproval[]> {
    if (!existsSync(this.approvalsPath)) return [];
    const content = await readFile(this.approvalsPath, 'utf-8');
    const parsed = parseYaml(content) as { approvals?: unknown[] };
    const approvals: FederationApproval[] = [];
    for (const raw of parsed.approvals ?? []) {
      const result = FederationApprovalSchema.safeParse(raw);
      if (result.success) approvals.push(result.data);
    }
    return approvals;
  }

  private async persist(approval: FederationApproval): Promise<void> {
    const existing = await this.load();
    // Replace any existing approval for same triple
    const filtered = existing.filter(
      (a) =>
        !(
          a.source_project_id === approval.source_project_id &&
          a.target_project_id === approval.target_project_id &&
          a.pattern_hash === approval.pattern_hash
        )
    );
    await this.writeAll([...filtered, approval]);
  }

  private async writeAll(approvals: FederationApproval[]): Promise<void> {
    const dir = dirname(this.approvalsPath);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await writeFile(this.approvalsPath, stringifyYaml({ approvals }, { indent: 2 }), 'utf-8');
  }
}
