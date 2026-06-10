// packages/cli/src/command.ts
import type { GlobalFlags } from './flags.js';
import type { Formatter } from './formatters.js';
import type { ProLicense } from './license.js';
import type { ExitCodeValue } from './exit-codes.js';
import type { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';

export interface CommandCtx {
  flags: GlobalFlags;
  formatter: Formatter;
  scopeId?: string;
  configDir: string;
  logger: MeshLogger;
  metrics: MeshMetrics;
  license: ProLicense;
  rest: string[];
}

export interface CommandResult {
  exitCode: ExitCodeValue;
  payload?: unknown;
  columns?: string[];
  title?: string;
}

export interface Command {
  readonly name: string;
  readonly description: string;
  run(ctx: CommandCtx): Promise<CommandResult>;
}
