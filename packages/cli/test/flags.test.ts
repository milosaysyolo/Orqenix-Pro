// packages/cli/test/flags.test.ts
import { describe, it, expect } from 'vitest';
import { parseGlobalCli } from '../src/flags.js';
import { UsageError } from '../src/exit-codes.js';

describe('global flag parser', () => {
  it('parses default flags + command', () => {
    const r = parseGlobalCli(['auth', 'status']);
    if ('help' in r) throw new Error('unexpected help');
    expect(r.global.format).toBe('table');
    expect(r.command).toBe('auth');
    expect(r.rest).toEqual(['status']);
  });

  it('parses --json before command', () => {
    const r = parseGlobalCli(['--json', 'auth', 'status']);
    if ('help' in r) throw new Error('unexpected help');
    expect(r.global.format).toBe('json');
  });

  it('rejects mutually exclusive output flags', () => {
    expect(() => parseGlobalCli(['--json', '--plain', 'auth', 'status'])).toThrow(UsageError);
  });

  it('reads --scope value and forwards subcommand args', () => {
    const r = parseGlobalCli(['--scope', 'scp_b3_a', 'auth', 'status', '--extra']);
    if ('help' in r) throw new Error('unexpected help');
    expect(r.global.scopeId).toBe('scp_b3_a');
    expect(r.command).toBe('auth');
    expect(r.rest).toEqual(['status', '--extra']);
  });

  it('treats --help as a help request', () => {
    const r = parseGlobalCli(['--help']);
    expect('help' in r && r.help).toBe(true);
  });

  it('throws UsageError when no command provided', () => {
    expect(() => parseGlobalCli(['--verbose'])).toThrow(UsageError);
  });

  it('--no-color sets noColor true', () => {
    const r = parseGlobalCli(['--no-color', 'auth', 'status']);
    if ('help' in r) throw new Error('unexpected help');
    expect(r.global.noColor).toBe(true);
  });

  it('respects --config <dir>', () => {
    const r = parseGlobalCli(['--config', '/tmp/myorq', 'auth', 'status']);
    if ('help' in r) throw new Error('unexpected help');
    expect(r.global.configDir).toBe('/tmp/myorq');
  });

  it('defaultsFromValues handles all flag variations via help', () => {
    const r = parseGlobalCli(['--json', '--scope', 'scp_x', '--no-color', '--config', '/custom', '--help']);
    expect('help' in r).toBe(true);
    if ('help' in r) {
      expect(r.global.format).toBe('json');
      expect(r.global.scopeId).toBe('scp_x');
      expect(r.global.noColor).toBe(true);
      expect(r.global.configDir).toBe('/custom');
    }
  });
});
