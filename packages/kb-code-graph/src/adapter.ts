// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-001 Kuzu Adapter
// @gate G18-pro.1, G18-pro.2

import {
  CodeSymbolSchema, CodeEdgeSchema,
  SymbolNotFoundError, EdgeNotFoundError,
  type CodeSymbol, type CodeEdge, type EdgeKind, type SymbolKind,
} from './contracts.js';

export interface GraphDriver {
  init(): Promise<void>;
  upsertSymbol(s: CodeSymbol): Promise<void>;
  upsertEdge(e: CodeEdge): Promise<void>;
  getSymbol(symbolId: string): Promise<CodeSymbol | null>;
  getEdge(edgeId: string): Promise<CodeEdge | null>;
  listSymbolsByScope(scopeId: string, kind?: SymbolKind): Promise<CodeSymbol[]>;
  listOutgoing(sourceSymbolId: string, kind?: EdgeKind): Promise<CodeEdge[]>;
  listIncoming(targetSymbolId: string, kind?: EdgeKind): Promise<CodeEdge[]>;
  removeSymbol(symbolId: string): Promise<boolean>;
  removeEdge(edgeId: string): Promise<boolean>;
  countSymbols(scopeId: string): Promise<number>;
  countEdges(scopeId: string): Promise<number>;
  close(): Promise<void>;
}

export class InMemoryGraphDriver implements GraphDriver {
  private symbols = new Map<string, CodeSymbol>();
  private edges = new Map<string, CodeEdge>();
  private outgoing = new Map<string, Set<string>>();
  private incoming = new Map<string, Set<string>>();

  async init(): Promise<void> { /* no-op */ }

  async upsertSymbol(s: CodeSymbol): Promise<void> {
    CodeSymbolSchema.parse(s);
    this.symbols.set(s.symbolId, s);
  }

  async upsertEdge(e: CodeEdge): Promise<void> {
    CodeEdgeSchema.parse(e);
    this.edges.set(e.edgeId, e);
    if (!this.outgoing.has(e.sourceSymbolId)) this.outgoing.set(e.sourceSymbolId, new Set());
    this.outgoing.get(e.sourceSymbolId)!.add(e.edgeId);
    if (!this.incoming.has(e.targetSymbolId)) this.incoming.set(e.targetSymbolId, new Set());
    this.incoming.get(e.targetSymbolId)!.add(e.edgeId);
  }

  async getSymbol(id: string): Promise<CodeSymbol | null> { return this.symbols.get(id) ?? null; }
  async getEdge(id: string): Promise<CodeEdge | null> { return this.edges.get(id) ?? null; }

  async listSymbolsByScope(scopeId: string, kind?: SymbolKind): Promise<CodeSymbol[]> {
    return [...this.symbols.values()]
      .filter((s) => s.scopeId === scopeId && (!kind || s.kind === kind))
      .sort((a, b) => a.symbolId.localeCompare(b.symbolId));
  }

  async listOutgoing(source: string, kind?: EdgeKind): Promise<CodeEdge[]> {
    const ids = this.outgoing.get(source);
    if (!ids) return [];
    const out: CodeEdge[] = [];
    for (const id of ids) {
      const e = this.edges.get(id);
      if (e && (!kind || e.kind === kind)) out.push(e);
    }
    return out;
  }

  async listIncoming(target: string, kind?: EdgeKind): Promise<CodeEdge[]> {
    const ids = this.incoming.get(target);
    if (!ids) return [];
    const out: CodeEdge[] = [];
    for (const id of ids) {
      const e = this.edges.get(id);
      if (e && (!kind || e.kind === kind)) out.push(e);
    }
    return out;
  }

  async removeSymbol(id: string): Promise<boolean> {
    const removed = this.symbols.delete(id);
    for (const e of [...this.edges.values()]) {
      if (e.sourceSymbolId === id || e.targetSymbolId === id) {
        this.edges.delete(e.edgeId);
        this.outgoing.get(e.sourceSymbolId)?.delete(e.edgeId);
        this.incoming.get(e.targetSymbolId)?.delete(e.edgeId);
      }
    }
    return removed;
  }

  async removeEdge(id: string): Promise<boolean> {
    const e = this.edges.get(id);
    if (!e) return false;
    this.edges.delete(id);
    this.outgoing.get(e.sourceSymbolId)?.delete(id);
    this.incoming.get(e.targetSymbolId)?.delete(id);
    return true;
  }

  async countSymbols(scopeId: string): Promise<number> {
    let c = 0; for (const s of this.symbols.values()) if (s.scopeId === scopeId) c++;
    return c;
  }
  async countEdges(scopeId: string): Promise<number> {
    let c = 0; for (const e of this.edges.values()) if (e.scopeId === scopeId) c++;
    return c;
  }

  async close(): Promise<void> { /* no-op */ }
}

export interface KuzuGraphAdapterOptions {
  dbPath: string;
  driver?: GraphDriver;
}

export class KuzuGraphAdapter {
  private readonly driver: GraphDriver;
  constructor(opts: KuzuGraphAdapterOptions) {
    this.driver = opts.driver ?? new InMemoryGraphDriver();
  }

  async init(): Promise<void> { await this.driver.init(); }
  async close(): Promise<void> { await this.driver.close(); }

  async addSymbol(s: CodeSymbol): Promise<CodeSymbol> {
    await this.driver.upsertSymbol(s);
    return s;
  }

  async addEdge(e: CodeEdge): Promise<CodeEdge> {
    const src = await this.driver.getSymbol(e.sourceSymbolId);
    const dst = await this.driver.getSymbol(e.targetSymbolId);
    if (!src) throw new SymbolNotFoundError(e.sourceSymbolId);
    if (!dst) throw new SymbolNotFoundError(e.targetSymbolId);
    await this.driver.upsertEdge(e);
    return e;
  }

  async getSymbol(id: string): Promise<CodeSymbol> {
    const s = await this.driver.getSymbol(id);
    if (!s) throw new SymbolNotFoundError(id);
    return s;
  }

  async getEdge(id: string): Promise<CodeEdge> {
    const e = await this.driver.getEdge(id);
    if (!e) throw new EdgeNotFoundError(id);
    return e;
  }

  async listSymbols(scopeId: string, kind?: SymbolKind): Promise<CodeSymbol[]> {
    return this.driver.listSymbolsByScope(scopeId, kind);
  }
  async listOutgoing(source: string, kind?: EdgeKind): Promise<CodeEdge[]> {
    return this.driver.listOutgoing(source, kind);
  }
  async listIncoming(target: string, kind?: EdgeKind): Promise<CodeEdge[]> {
    return this.driver.listIncoming(target, kind);
  }

  async removeSymbol(id: string): Promise<boolean> { return this.driver.removeSymbol(id); }
  async removeEdge(id: string): Promise<boolean> { return this.driver.removeEdge(id); }

  async countSymbols(scopeId: string): Promise<number> { return this.driver.countSymbols(scopeId); }
  async countEdges(scopeId: string): Promise<number> { return this.driver.countEdges(scopeId); }

  async neighbors(symbolId: string, depth = 1): Promise<{ symbols: CodeSymbol[]; edges: CodeEdge[] }> {
    if (depth < 0 || depth > 8) throw new Error(`invalid depth: ${depth}`);
    const visitedSymbols = new Set<string>([symbolId]);
    const visitedEdges = new Set<string>();
    const symbols: CodeSymbol[] = [];
    const edges: CodeEdge[] = [];
    let frontier = [symbolId];

    for (let d = 0; d < depth; d++) {
      const next: string[] = [];
      for (const s of frontier) {
        const out = await this.driver.listOutgoing(s);
        const inc = await this.driver.listIncoming(s);
        for (const e of [...out, ...inc]) {
          if (visitedEdges.has(e.edgeId)) continue;
          visitedEdges.add(e.edgeId);
          edges.push(e);
          const other = e.sourceSymbolId === s ? e.targetSymbolId : e.sourceSymbolId;
          if (!visitedSymbols.has(other)) {
            visitedSymbols.add(other);
            const sym = await this.driver.getSymbol(other);
            if (sym) { symbols.push(sym); next.push(other); }
          }
        }
      }
      frontier = next;
    }

    return { symbols, edges };
  }
}
