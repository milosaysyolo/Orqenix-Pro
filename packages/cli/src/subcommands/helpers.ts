import { UsageError } from '../exit-codes.js';

export function formatRtt(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'n/a';
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  if (ms < 10_000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function truncateForTable(s: string, max = 56): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + '...';
}

export function requirePositional(rest: string[], index: number, label: string): string {
  const v = rest[index];
  if (typeof v !== 'string' || v.length === 0) {
    throw new UsageError(`missing argument: ${label}`);
  }
  return v;
}

export function extractFlag(rest: string[], name: string): string | undefined {
  const eq = `--${name}=`;
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    if (tok === `--${name}`) return rest[i + 1];
    if (tok.startsWith(eq)) return tok.slice(eq.length);
  }
  return undefined;
}

export function extractIntFlag(rest: string[], name: string, def: number, min: number, max: number): number {
  const raw = extractFlag(rest, name);
  if (raw == null) return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new UsageError(`--${name} must be an integer in [${min}, ${max}]`);
  }
  return n;
}

export function extractBoolFlag(rest: string[], name: string): boolean {
  return rest.includes(`--${name}`);
}

export function shortScope(id: string, max = 22): string {
  return truncateForTable(id, max);
}
