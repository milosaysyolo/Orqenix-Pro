import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NotFoundError } from '../exit-codes.js';

export interface TransportInfoSnapshot {
  kind: 'http' | 'libp2p' | string;
  addresses: string[];
  peers: number;
}

export interface BreakerStateSnapshot {
  kind: string;
  state: 'Closed' | 'Open' | 'HalfOpen';
}

export interface RpcSummary {
  transport: string;
  status: 'ok' | 'denied' | 'error' | 'timeout';
  count: number;
}

export interface DurationSummary {
  transport: string;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  count: number;
}

export interface DiscoverySnapshot {
  entries: number;
}

export interface KeyStoreSnapshot {
  hits: number;
  misses: number;
  size: number;
}

export interface NodeStatusSnapshot {
  scopeId: string;
  capturedAt: string;
  transports: TransportInfoSnapshot[];
  breaker: BreakerStateSnapshot[];
  rpcSummaries: RpcSummary[];
  durations: DurationSummary[];
  discovery: DiscoverySnapshot;
  keyStore: KeyStoreSnapshot;
}

export interface NodeInspector {
  readStatus(): Promise<NodeStatusSnapshot>;
}

export class FileBackedInspector implements NodeInspector {
  private readonly path: string;

  constructor(configDir: string, filename = 'status.json') {
    this.path = join(configDir, 'runtime', filename);
  }

  async readStatus(): Promise<NodeStatusSnapshot> {
    let text: string;
    try {
      text = await readFile(this.path, 'utf8');
    } catch {
      throw new NotFoundError(
        `no runtime status at ${this.path}`,
        'Try: orqenix-node start',
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new NotFoundError(`runtime status at ${this.path} is malformed`, 'Re-start the node to regenerate.');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new NotFoundError(`runtime status at ${this.path} is not an object`);
    }
    return parsed as NodeStatusSnapshot;
  }
}
