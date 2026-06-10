// packages/cli/src/flags.ts
import { parseArgs } from 'node:util';
import { UsageError } from './exit-codes.js';
import type { FormatName } from './formatters.js';

export interface GlobalFlags {
  format: FormatName;
  scopeId?: string;
  verbose: boolean;
  noColor: boolean;
  configDir: string;
}

export interface ParsedCli {
  global: GlobalFlags;
  command: string;
  rest: string[];
}

const GLOBAL_OPTIONS = {
  json:        { type: 'boolean' as const },
  table:       { type: 'boolean' as const },
  plain:       { type: 'boolean' as const },
  scope:       { type: 'string'  as const, short: 's' },
  verbose:     { type: 'boolean' as const, short: 'v' },
  'no-color':  { type: 'boolean' as const },
  config:      { type: 'string'  as const, short: 'c' },
  help:        { type: 'boolean' as const, short: 'h' },
} as const;

function splitArgv(argv: string[]): { globalArgs: string[]; command: string | undefined; rest: string[] } {
  const valueTaking = new Set(['--scope', '-s', '--config', '-c']);

  const globalArgs: string[] = [];
  let i = 0;
  for (; i < argv.length; i++) {
    const tok = argv[i];
    if (tok.startsWith('-')) {
      globalArgs.push(tok);
      if (valueTaking.has(tok) && i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        i++;
        globalArgs.push(argv[i]);
      }
      continue;
    }
    return { globalArgs, command: tok, rest: argv.slice(i + 1) };
  }
  return { globalArgs, command: undefined, rest: [] };
}

export function parseGlobalCli(argv: string[]): ParsedCli | { help: true; global: GlobalFlags } {
  const { globalArgs, command, rest } = splitArgv(argv);

  let values: Record<string, unknown>;
  try {
    ({ values } = parseArgs({
      args: globalArgs,
      options: GLOBAL_OPTIONS,
      allowPositionals: false,
      strict: true,
    }));
  } catch (e) {
    throw new UsageError(`bad flags: ${(e as Error).message}`);
  }

  if (values.help) {
    return { help: true, global: defaultsFromValues(values) };
  }

  if (!command) {
    throw new UsageError('missing command', 'Try: orqenix help');
  }

  const formatFlags = [values.json, values.table, values.plain].filter(Boolean).length;
  if (formatFlags > 1) {
    throw new UsageError('--json, --table, --plain are mutually exclusive');
  }
  const format: FormatName = values.json ? 'json' : values.plain ? 'plain' : 'table';

  const global: GlobalFlags = {
    format,
    scopeId: typeof values.scope === 'string' ? values.scope : undefined,
    verbose: !!values.verbose,
    noColor: !!values['no-color'] || process.env.NO_COLOR != null,
    configDir: typeof values.config === 'string' && values.config.length > 0 ? values.config : '.orqenix',
  };

  return { global, command, rest };
}

function defaultsFromValues(values: Record<string, unknown>): GlobalFlags {
  const format: FormatName = values.json ? 'json' : values.plain ? 'plain' : 'table';
  return {
    format,
    scopeId: typeof values.scope === 'string' ? values.scope : undefined,
    verbose: !!values.verbose,
    noColor: !!values['no-color'] || process.env.NO_COLOR != null,
    configDir: typeof values.config === 'string' && values.config.length > 0 ? values.config : '.orqenix',
  };
}
