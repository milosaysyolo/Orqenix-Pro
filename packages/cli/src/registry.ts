// packages/cli/src/registry.ts
import type { Command } from './command.js';
import { NotFoundError } from './exit-codes.js';

export class CommandRegistry {
  private readonly byName = new Map<string, Command>();

  register(cmd: Command): void {
    if (!cmd.name || cmd.name.trim().length === 0) {
      throw new Error('CommandRegistry: command name required');
    }
    if (this.byName.has(cmd.name)) {
      throw new Error(`CommandRegistry: ${cmd.name} already registered`);
    }
    this.byName.set(cmd.name, cmd);
  }

  resolve(tokens: string[]): { command: Command; rest: string[] } {
    if (tokens.length === 0) throw new NotFoundError('no command');
    for (let n = Math.min(tokens.length, 4); n >= 1; n--) {
      const name = tokens.slice(0, n).join(' ');
      const c = this.byName.get(name);
      if (c) return { command: c, rest: tokens.slice(n) };
    }
    throw new NotFoundError(`unknown command: ${tokens[0]}`, 'Try: orqenix help');
  }

  list(): Command[] {
    return [...this.byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
