// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  KuzuGraphAdapter, InMemoryGraphDriver,
  SymbolNotFoundError, EdgeNotFoundError,
  type CodeSymbol, type CodeEdge,
} from '../src';

const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function sym(id: string, kind: CodeSymbol['kind'] = 'function', name: string = id): CodeSymbol {
  return {
    symbolId: id, scopeId: SCOPE, kind, name,
    filePath: `src/${name}.ts`, lineStart: 1, lineEnd: 10,
    createdAt: '2026-06-02T00:00:00Z',
  };
}
function edg(id: string, source: string, target: string, kind: CodeEdge['kind'] = 'calls'): CodeEdge {
  return {
    edgeId: id, scopeId: SCOPE, sourceSymbolId: source, targetSymbolId: target,
    kind, metadata: {}, createdAt: '2026-06-02T00:00:00Z',
  };
}

describe('KuzuGraphAdapter (InMemoryGraphDriver fallback)', () => {
  let adapter: KuzuGraphAdapter;

  beforeEach(async () => {
    adapter = new KuzuGraphAdapter({ dbPath: ':memory:', driver: new InMemoryGraphDriver() });
    await adapter.init();
  });
  afterEach(async () => { await adapter.close(); });

  it('addSymbol + getSymbol round-trip', async () => {
    await adapter.addSymbol(sym('s1'));
    const got = await adapter.getSymbol('s1');
    expect(got.name).toBe('s1');
  });

  it('getSymbol throws SymbolNotFoundError on missing', async () => {
    await expect(adapter.getSymbol('missing')).rejects.toThrow(SymbolNotFoundError);
  });

  it('upsertSymbol overwrites existing', async () => {
    await adapter.addSymbol(sym('s1', 'function', 'oldName'));
    await adapter.addSymbol(sym('s1', 'function', 'newName'));
    const got = await adapter.getSymbol('s1');
    expect(got.name).toBe('newName');
  });

  it('addEdge requires both endpoints to exist', async () => {
    await adapter.addSymbol(sym('s1'));
    await expect(adapter.addEdge(edg('e1', 's1', 'missing'))).rejects.toThrow(SymbolNotFoundError);
  });

  it('addEdge + getEdge round-trip', async () => {
    await adapter.addSymbol(sym('s1'));
    await adapter.addSymbol(sym('s2'));
    await adapter.addEdge(edg('e1', 's1', 's2'));
    const got = await adapter.getEdge('e1');
    expect(got.kind).toBe('calls');
  });

  it('listSymbols filters by kind', async () => {
    await adapter.addSymbol(sym('s1', 'function'));
    await adapter.addSymbol(sym('s2', 'class'));
    await adapter.addSymbol(sym('s3', 'function'));
    const fns = await adapter.listSymbols(SCOPE, 'function');
    expect(fns.map((s) => s.symbolId).sort()).toEqual(['s1', 's3']);
  });

  it('listOutgoing + listIncoming work bidirectionally', async () => {
    await adapter.addSymbol(sym('s1'));
    await adapter.addSymbol(sym('s2'));
    await adapter.addEdge(edg('e1', 's1', 's2', 'calls'));
    expect((await adapter.listOutgoing('s1')).map((e) => e.edgeId)).toEqual(['e1']);
    expect((await adapter.listIncoming('s2')).map((e) => e.edgeId)).toEqual(['e1']);
  });

  it('removeSymbol cascades to incident edges', async () => {
    await adapter.addSymbol(sym('s1'));
    await adapter.addSymbol(sym('s2'));
    await adapter.addEdge(edg('e1', 's1', 's2'));
    await adapter.removeSymbol('s1');
    await expect(adapter.getEdge('e1')).rejects.toThrow(EdgeNotFoundError);
  });

  it('neighbors(symbol, depth=1) returns direct neighbors', async () => {
    for (const id of ['s1', 's2', 's3', 's4']) await adapter.addSymbol(sym(id));
    await adapter.addEdge(edg('e1', 's1', 's2'));
    await adapter.addEdge(edg('e2', 's2', 's3'));
    await adapter.addEdge(edg('e3', 's3', 's4'));
    const result = await adapter.neighbors('s1', 1);
    expect(result.symbols.map((s) => s.symbolId).sort()).toEqual(['s2']);
    expect(result.edges).toHaveLength(1);
  });

  it('neighbors(symbol, depth=3) traverses 3 hops', async () => {
    for (const id of ['s1', 's2', 's3', 's4']) await adapter.addSymbol(sym(id));
    await adapter.addEdge(edg('e1', 's1', 's2'));
    await adapter.addEdge(edg('e2', 's2', 's3'));
    await adapter.addEdge(edg('e3', 's3', 's4'));
    const result = await adapter.neighbors('s1', 3);
    expect(result.symbols.map((s) => s.symbolId).sort()).toEqual(['s2', 's3', 's4']);
  });

  it('countSymbols + countEdges report per-scope totals', async () => {
    await adapter.addSymbol(sym('s1'));
    await adapter.addSymbol(sym('s2'));
    await adapter.addEdge(edg('e1', 's1', 's2'));
    expect(await adapter.countSymbols(SCOPE)).toBe(2);
    expect(await adapter.countEdges(SCOPE)).toBe(1);
  });

  it('rejects invalid lineRange (lineEnd < lineStart)', async () => {
    const bad = sym('bad');
    bad.lineEnd = 0; bad.lineStart = 100;
    await expect(adapter.addSymbol(bad)).rejects.toThrow();
  });

  it('rejects invalid neighbor depth', async () => {
    await adapter.addSymbol(sym('s1'));
    await expect(adapter.neighbors('s1', -1)).rejects.toThrow();
    await expect(adapter.neighbors('s1', 9)).rejects.toThrow();
  });
});
