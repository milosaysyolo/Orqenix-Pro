// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-005 Type Mapping
// @gate G6-pro.3

import type { MemoryType } from '@orqenix/memory-tiers';
import type { ProMemoryType } from './contracts.js';

// Map the 5 Pro-only types into the closest OSS storage type so they coexist in MemoryTierStore.
// The original Pro type is preserved in metadata.proType for query-time fidelity.
const MAP: Record<ProMemoryType, MemoryType> = {
  fact: 'fact',
  preference: 'preference',
  decision: 'decision',
  task: 'task',
  learning: 'learning',
  relationship: 'relationship',
  skill: 'skill',
  observation: 'observation',
  decision_rationale: 'decision',
  code_pattern: 'skill',
  anti_pattern: 'learning',
  dependency_rule: 'fact',
  troubleshooting: 'skill',
};

export function mapProToOssMemoryType(proType: ProMemoryType): MemoryType {
  return MAP[proType];
}

export function isProOnlyType(proType: ProMemoryType): boolean {
  return proType === 'decision_rationale' || proType === 'code_pattern' ||
         proType === 'anti_pattern' || proType === 'dependency_rule' || proType === 'troubleshooting';
}
