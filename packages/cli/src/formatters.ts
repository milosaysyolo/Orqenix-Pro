// packages/cli/src/formatters.ts
export type FormatName = 'json' | 'table' | 'plain';

export interface FormatterContext {
  columns?: string[];
  title?: string;
  noColor: boolean;
}

export interface Formatter {
  readonly name: FormatName;
  render(data: unknown, ctx: FormatterContext): string;
}

export class JsonFormatter implements Formatter {
  readonly name = 'json' as const;
  render(data: unknown): string {
    return JSON.stringify(data, replacer, 2) + '\n';
  }
}

export class PlainFormatter implements Formatter {
  readonly name = 'plain' as const;
  render(data: unknown, ctx: FormatterContext): string {
    if (data == null) return '';
    if (Array.isArray(data)) {
      return (data as unknown[]).map((row) => this.renderRow(row, ctx)).join('\n') + '\n';
    }
    return this.renderRow(data, ctx) + '\n';
  }
  private renderRow(row: unknown, ctx: FormatterContext): string {
    if (row == null) return '';
    if (typeof row !== 'object') return String(row);
    const cols = ctx.columns ?? Object.keys(row as Record<string, unknown>);
    return cols.map((c) => stringifyValue((row as Record<string, unknown>)[c])).join('\t');
  }
}

export class TableFormatter implements Formatter {
  readonly name = 'table' as const;

  render(data: unknown, ctx: FormatterContext): string {
    const rows = Array.isArray(data) ? data as unknown[] : data == null ? [] : [data];
    const cols = ctx.columns ?? inferColumns(rows);

    if (rows.length === 0) {
      const header = ctx.title ? `${ctx.title}\n` : '';
      return header + '(no rows)\n';
    }

    const widths = computeWidths(cols, rows);
    const sep = '  ';
    const out: string[] = [];
    if (ctx.title) out.push(applyBold(ctx.title, ctx.noColor));
    out.push(cols.map((c, i) => applyBold(c.padEnd(widths[i]), ctx.noColor)).join(sep));
    out.push(cols.map((_, i) => '-'.repeat(widths[i])).join(sep));
    for (const row of rows) {
      out.push(cols.map((c, i) => stringifyValue((row as Record<string, unknown>)?.[c]).padEnd(widths[i])).join(sep));
    }
    return out.join('\n') + '\n';
  }
}

export function makeFormatter(name: FormatName): Formatter {
  switch (name) {
    case 'json':  return new JsonFormatter();
    case 'plain': return new PlainFormatter();
    case 'table':
    default:      return new TableFormatter();
  }
}

function inferColumns(rows: unknown[]): string[] {
  for (const r of rows) {
    if (r && typeof r === 'object' && !Array.isArray(r)) {
      return Object.keys(r as Record<string, unknown>);
    }
  }
  return ['value'];
}

function computeWidths(cols: string[], rows: unknown[]): number[] {
  return cols.map((c) => {
    let max = c.length;
    for (const r of rows) {
      const v = stringifyValue((r as Record<string, unknown>)?.[c]);
      if (v.length > max) max = v.length;
    }
    return max;
  });
}

function stringifyValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return `<${v.length} bytes>`;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) return { __bytes: value.length };
  if (typeof value === 'bigint') return value.toString();
  return value;
}

const ANSI_BOLD = '\x1b[1m';
const ANSI_RESET = '\x1b[0m';

function applyBold(text: string, noColor: boolean): string {
  if (noColor || process.env.NO_COLOR != null || !process.stdout.isTTY) return text;
  return `${ANSI_BOLD}${text}${ANSI_RESET}`;
}
