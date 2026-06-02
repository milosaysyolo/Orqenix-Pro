// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { mapProToOssMemoryType, isProOnlyType } from '../src';

describe('type-mapping', () => {
  it('OSS types map to themselves', () => {
    expect(mapProToOssMemoryType('fact')).toBe('fact');
    expect(mapProToOssMemoryType('preference')).toBe('preference');
    expect(mapProToOssMemoryType('observation')).toBe('observation');
  });

  it('decision_rationale -> decision', () => {
    expect(mapProToOssMemoryType('decision_rationale')).toBe('decision');
  });

  it('code_pattern + troubleshooting -> skill', () => {
    expect(mapProToOssMemoryType('code_pattern')).toBe('skill');
    expect(mapProToOssMemoryType('troubleshooting')).toBe('skill');
  });

  it('anti_pattern -> learning', () => {
    expect(mapProToOssMemoryType('anti_pattern')).toBe('learning');
  });

  it('dependency_rule -> fact', () => {
    expect(mapProToOssMemoryType('dependency_rule')).toBe('fact');
  });

  it('isProOnlyType identifies the 5 Pro-only types', () => {
    expect(isProOnlyType('decision_rationale')).toBe(true);
    expect(isProOnlyType('code_pattern')).toBe(true);
    expect(isProOnlyType('anti_pattern')).toBe(true);
    expect(isProOnlyType('dependency_rule')).toBe(true);
    expect(isProOnlyType('troubleshooting')).toBe(true);
    expect(isProOnlyType('fact')).toBe(false);
    expect(isProOnlyType('preference')).toBe(false);
  });
});
