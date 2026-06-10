// packages/cli/src/application.ts
import { MeshLogger, MeshMetrics } from '@orqenix/mesh-observability';
import { ExitCode, type ExitCodeValue, classifyError } from './exit-codes.js';
import { parseGlobalCli, type GlobalFlags, type ParsedCli } from './flags.js';
import { makeFormatter, type Formatter } from './formatters.js';
import { CommandRegistry } from './registry.js';
import { loadAndVerifyLicense, type ProLicense, type ProLicenseVerifier } from './license.js';

export interface ApplicationOptions {
  registry: CommandRegistry;
  verifier: ProLicenseVerifier;
  stdout?: (s: string) => void;
  stderr?: (s: string) => void;
  now?: () => number;
}

export class Application {
  private readonly registry: CommandRegistry;
  private readonly verifier: ProLicenseVerifier;
  private readonly stdout: (s: string) => void;
  private readonly stderr: (s: string) => void;
  private readonly now: () => number;

  constructor(opts: ApplicationOptions) {
    this.registry = opts.registry;
    this.verifier = opts.verifier;
    this.stdout = opts.stdout ?? ((s) => process.stdout.write(s));
    this.stderr = opts.stderr ?? ((s) => process.stderr.write(s));
    this.now = opts.now ?? Date.now;
  }

  async run(argv: string[]): Promise<ExitCodeValue> {
    let parsed: ParsedCli | { help: true; global: GlobalFlags };
    try {
      const p = parseGlobalCli(argv);
      if ('help' in p) {
        this.printHelp(p.global);
        return ExitCode.SUCCESS;
      }
      parsed = p;
    } catch (e) {
      const { exitCode, message, tip } = classifyError(e);
      this.printError(message, tip);
      return exitCode;
    }

    const { global, command, rest } = parsed;

    if (command === 'help' || command === '--help') {
      this.printHelp(global);
      return ExitCode.SUCCESS;
    }

    let license: ProLicense;
    try {
      license = await loadAndVerifyLicense({
        configDir: global.configDir,
        verifier: this.verifier,
        now: this.now,
      });
    } catch (e) {
      const { exitCode, message, tip } = classifyError(e);
      this.printError(message, tip);
      return exitCode;
    }

    const tokens = [command, ...rest];
    let resolved;
    try {
      resolved = this.registry.resolve(tokens);
    } catch (e) {
      const { exitCode, message, tip } = classifyError(e);
      this.printError(message, tip);
      return exitCode;
    }

    const formatter: Formatter = makeFormatter(global.format);
    const logger = new MeshLogger({ level: global.verbose ? 'debug' : 'info' });
    const metrics = new MeshMetrics();
    const ctx = {
      flags: global,
      formatter,
      scopeId: global.scopeId,
      configDir: global.configDir,
      logger,
      metrics,
      license,
      rest: resolved.rest,
    };

    try {
      const result = await resolved.command.run(ctx);
      this.writeResult(result, formatter, global);
      return result.exitCode;
    } catch (e) {
      const { exitCode, message, tip } = classifyError(e);
      this.printError(message, tip);
      return exitCode;
    }
  }

  private writeResult(result: { payload?: unknown; columns?: string[]; title?: string }, formatter: Formatter, global: GlobalFlags): void {
    if (result.payload === undefined) return;
    const text = formatter.render(result.payload, {
      columns: result.columns,
      title: result.title,
      noColor: global.noColor,
    });
    this.stdout(text);
  }

  private printError(message: string, tip?: string): void {
    this.stderr(`error: ${message}\n`);
    if (tip) this.stderr(`hint: ${tip}\n`);
  }

  private printHelp(_global: GlobalFlags): void {
    const cmds = this.registry.list();
    const lines: string[] = [
      'orqenix 0.6.0-phase-6 (Pro)',
      '',
      'Usage:',
      '  orqenix [GLOBAL_FLAGS] <command> [ARGS...]',
      '',
      'Global flags:',
      '  --json | --table | --plain    output format (default --table)',
      '  --scope, -s <id>              operate against a specific scope',
      '  --config, -c <dir>            config dir (default .orqenix)',
      '  --verbose, -v                 increase log verbosity',
      '  --no-color                    disable ANSI color',
      '  --help, -h                    show this help',
      '',
      'Commands:',
    ];
    for (const c of cmds) {
      lines.push(`  ${c.name.padEnd(22)} ${c.description}`);
    }
    lines.push('', `Exit codes:`);
    lines.push('  0 success   1 generic   2 usage   3 auth/entitlement   4 not found   5 timeout');
    lines.push('');
    this.stdout(lines.join('\n'));
  }
}
