// packages/cli/src/exit-codes.ts
export const ExitCode = {
  SUCCESS: 0,
  GENERIC: 1,
  USAGE: 2,
  AUTH: 3,
  NOT_FOUND: 4,
  TIMEOUT: 5,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export class CliError extends Error {
  readonly code: ExitCodeValue;
  readonly tip?: string;

  constructor(message: string, code: ExitCodeValue, tip?: string) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.tip = tip;
  }
}

export class AuthError extends CliError {
  constructor(message: string, tip?: string) {
    super(message, ExitCode.AUTH, tip);
    this.name = 'AuthError';
  }
}

export class UsageError extends CliError {
  constructor(message: string, tip?: string) {
    super(message, ExitCode.USAGE, tip);
    this.name = 'UsageError';
  }
}

export class NotFoundError extends CliError {
  constructor(message: string, tip?: string) {
    super(message, ExitCode.NOT_FOUND, tip);
    this.name = 'NotFoundError';
  }
}

export class TimeoutError extends CliError {
  constructor(message: string, tip?: string) {
    super(message, ExitCode.TIMEOUT, tip);
    this.name = 'TimeoutError';
  }
}

export function sanitizeMessage(s: string): string {
  const oneLine = s.split('\n')[0];
  const noPaths = oneLine.replace(/(?:\/|\\)[\w./\\-]+\.(?:ts|js|mjs|cjs)/g, '<file>');
  const noFrames = noPaths.replace(/\s*at\s+\S+\s*\([^)]*\)/g, '');
  return noFrames.trim().slice(0, 240);
}

export function classifyError(err: unknown): { exitCode: ExitCodeValue; message: string; tip?: string } {
  if (err instanceof CliError) {
    return { exitCode: err.code, message: sanitizeMessage(err.message), tip: err.tip };
  }
  if (err instanceof Error) {
    return { exitCode: ExitCode.GENERIC, message: sanitizeMessage(err.message) };
  }
  return { exitCode: ExitCode.GENERIC, message: sanitizeMessage(String(err)) };
}
