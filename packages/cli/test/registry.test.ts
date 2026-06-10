// packages/cli/test/registry.test.ts
import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '../src/registry.js';
import { AuthStatusCommand } from '../src/subcommands/auth-status.js';
import { NotFoundError } from '../src/exit-codes.js';
import type { Command } from '../src/command.js';

function fakeCmd(name: string): Command {
  return {
    name,
    description: `fake ${name}`,
    async run() { return { exitCode: 0 as const }; },
  };
}

describe('CommandRegistry', () => {
  it('registers and resolves a single-token command', () => {
    const r = new CommandRegistry();
    r.register(fakeCmd('hello'));
    const { command, rest } = r.resolve(['hello', 'arg']);
    expect(command.name).toBe('hello');
    expect(rest).toEqual(['arg']);
  });

  it('resolves multi-token names via longest-match-first', () => {
    const r = new CommandRegistry();
    r.register(fakeCmd('mesh'));
    r.register(fakeCmd('mesh route'));
    r.register(AuthStatusCommand);

    const a = r.resolve(['mesh', 'route', 'scp_b3_x']);
    expect(a.command.name).toBe('mesh route');
    expect(a.rest).toEqual(['scp_b3_x']);

    const b = r.resolve(['auth', 'status']);
    expect(b.command.name).toBe('auth status');
    expect(b.rest).toEqual([]);
  });

  it('throws NotFoundError on unknown command', () => {
    const r = new CommandRegistry();
    expect(() => r.resolve(['totally-unknown'])).toThrow(NotFoundError);
  });

  it('rejects duplicate registration', () => {
    const r = new CommandRegistry();
    r.register(fakeCmd('hello'));
    expect(() => r.register(fakeCmd('hello'))).toThrow();
  });

  it('rejects empty command name', () => {
    const r = new CommandRegistry();
    expect(() => r.register(fakeCmd(''))).toThrow();
  });

  it('list returns commands sorted by name', () => {
    const r = new CommandRegistry();
    r.register(fakeCmd('zeta'));
    r.register(fakeCmd('alpha'));
    expect(r.list().map((c) => c.name)).toEqual(['alpha', 'zeta']);
  });
});
