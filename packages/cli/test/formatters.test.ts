// packages/cli/test/formatters.test.ts
import { describe, it, expect } from 'vitest';
import { makeFormatter } from '../src/formatters.js';

describe('formatters', () => {
  const ROWS = [
    { name: 'alpha', count: 1 },
    { name: 'bravo', count: 22 },
    { name: 'charlie', count: 333 },
  ];

  it('JsonFormatter produces parseable JSON', () => {
    const f = makeFormatter('json');
    const text = f.render(ROWS, { noColor: true });
    expect(JSON.parse(text)).toEqual(ROWS);
  });

  it('PlainFormatter produces tab-separated rows', () => {
    const f = makeFormatter('plain');
    const text = f.render(ROWS, { noColor: true, columns: ['name', 'count'] });
    const lines = text.trim().split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('alpha\t1');
    expect(lines[2]).toBe('charlie\t333');
  });

  it('TableFormatter aligns columns and respects --no-color', () => {
    const f = makeFormatter('table');
    const text = f.render(ROWS, { noColor: true, columns: ['name', 'count'], title: 'Counts' });
    expect(text).toContain('Counts');
    expect(text).toContain('name');
    expect(text).toContain('count');
    expect(text).not.toMatch(/\x1b\[/);
  });

  it('TableFormatter handles empty arrays', () => {
    const f = makeFormatter('table');
    const text = f.render([], { noColor: true, title: 'Empty' });
    expect(text).toContain('Empty');
    expect(text).toContain('(no rows)');
  });

  it('Json replacer converts Uint8Array to size summary', () => {
    const f = makeFormatter('json');
    const text = f.render({ data: new Uint8Array([1, 2, 3]) }, { noColor: true });
    const parsed = JSON.parse(text);
    expect(parsed.data.__bytes).toBe(3);
  });

  it('Plain handles null payload', () => {
    const f = makeFormatter('plain');
    expect(f.render(null, { noColor: true })).toBe('');
  });

  it('Plain handles string arrays (non-object rows)', () => {
    const f = makeFormatter('plain');
    const text = f.render(['alpha', 'bravo'], { noColor: true });
    const lines = text.trim().split('\n');
    expect(lines).toEqual(['alpha', 'bravo']);
  });

  it('JsonFormatter handles Date and Uint8Array via replacer', () => {
    const f = makeFormatter('json');
    const d = new Date('2025-06-01T00:00:00Z');
    const text = f.render({ date: d, data: new Uint8Array([10, 20]) }, { noColor: true });
    const parsed = JSON.parse(text);
    expect(parsed.date).toBe('2025-06-01T00:00:00.000Z');
    expect(parsed.data.__bytes).toBe(2);
  });

  it('TableFormatter renders a scalar payload via default column', () => {
    const f = makeFormatter('table');
    const text = f.render('hello', { noColor: true });
    expect(text).toContain('value');
    expect(text).toContain('-----');
  });
});
