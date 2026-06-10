// packages/cli/test/exit-codes.test.ts
import { describe, it, expect } from 'vitest';
import {
  AuthError,
  CliError,
  ExitCode,
  NotFoundError,
  TimeoutError,
  UsageError,
  classifyError,
  sanitizeMessage,
} from '../src/exit-codes.js';

describe('exit codes', () => {
  it('numeric constants match CR v7.2 Chapter 10.5', () => {
    expect(ExitCode.SUCCESS).toBe(0);
    expect(ExitCode.GENERIC).toBe(1);
    expect(ExitCode.USAGE).toBe(2);
    expect(ExitCode.AUTH).toBe(3);
    expect(ExitCode.NOT_FOUND).toBe(4);
    expect(ExitCode.TIMEOUT).toBe(5);
  });

  it('typed CliError subclasses carry the right exit code', () => {
    expect(new AuthError('x').code).toBe(ExitCode.AUTH);
    expect(new UsageError('x').code).toBe(ExitCode.USAGE);
    expect(new NotFoundError('x').code).toBe(ExitCode.NOT_FOUND);
    expect(new TimeoutError('x').code).toBe(ExitCode.TIMEOUT);
  });

  it('classifyError maps unknowns to GENERIC and strips stack/paths', () => {
    const err = new Error('boom at Foo (/abs/file.ts:1:1)');
    err.stack = 'Error: x\n    at Foo (/abs/file.ts:1:1)';
    const r = classifyError(err);
    expect(r.exitCode).toBe(ExitCode.GENERIC);
    expect(r.message).not.toMatch(/\(\/abs/);
  });

  it('classifyError preserves typed CliError code', () => {
    const r = classifyError(new AuthError('Pro license required', 'See docs'));
    expect(r.exitCode).toBe(ExitCode.AUTH);
    expect(r.tip).toBe('See docs');
  });

  it('sanitizeMessage trims length and removes stack frames', () => {
    const m = sanitizeMessage('first line\n at Foo (/abs/x.ts:1:1)');
    expect(m).toBe('first line');
  });

  it('CliError chain prints typed name', () => {
    const e = new CliError('boom', ExitCode.GENERIC);
    expect(e.name).toBe('CliError');
  });
});
