import { describe, it, expect } from 'vitest';
import {
  extractBoolFlag,
  extractFlag,
  extractIntFlag,
  formatRtt,
  requirePositional,
  shortScope,
  truncateForTable,
} from '../../src/subcommands/helpers.js';
import { UsageError } from '../../src/exit-codes.js';

describe('helpers', () => {
  it('formatRtt handles sub-100ms, integer, and seconds ranges', () => {
    expect(formatRtt(0)).toBe('0.0ms');
    expect(formatRtt(12.34)).toBe('12.3ms');
    expect(formatRtt(345)).toBe('345ms');
    expect(formatRtt(12000)).toBe('12.00s');
    expect(formatRtt(-1)).toBe('n/a');
    expect(formatRtt(Number.NaN)).toBe('n/a');
  });

  it('truncateForTable preserves short strings and ellipsizes long ones', () => {
    expect(truncateForTable('short', 10)).toBe('short');
    expect(truncateForTable('a'.repeat(20), 10)).toBe('aaaaaaa...');
  });

  it('requirePositional throws UsageError when missing', () => {
    expect(() => requirePositional([], 0, 'scope')).toThrow(UsageError);
    expect(requirePositional(['x'], 0, 'scope')).toBe('x');
  });

  it('extractFlag supports --name value and --name=value', () => {
    expect(extractFlag(['--foo', 'bar'], 'foo')).toBe('bar');
    expect(extractFlag(['--foo=bar'], 'foo')).toBe('bar');
    expect(extractFlag(['--other'], 'foo')).toBeUndefined();
  });

  it('extractIntFlag enforces bounds', () => {
    expect(extractIntFlag(['--n', '5'], 'n', 1, 1, 10)).toBe(5);
    expect(() => extractIntFlag(['--n', '100'], 'n', 1, 1, 10)).toThrow(UsageError);
    expect(extractIntFlag([], 'n', 7, 1, 10)).toBe(7);
  });

  it('extractBoolFlag returns presence', () => {
    expect(extractBoolFlag(['--verbose'], 'verbose')).toBe(true);
    expect(extractBoolFlag([], 'verbose')).toBe(false);
  });

  it('shortScope truncates only long ids', () => {
    expect(shortScope('scp_b3_short')).toBe('scp_b3_short');
    expect(shortScope('a'.repeat(40)).endsWith('...')).toBe(true);
  });
});
