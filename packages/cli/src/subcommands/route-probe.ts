import { TimeoutError, UsageError } from '../exit-codes.js';

export interface RouteHop {
  hop: number;
  transport: 'http' | 'libp2p' | string;
  address: string;
  rttMs: number;
  status: 'ok' | 'denied' | 'error' | 'timeout';
}

export interface RouteProbeResult {
  target: string;
  hops: RouteHop[];
  totalRttMs: number;
  finalStatus: 'ok' | 'denied' | 'error' | 'timeout';
}

export interface RouteProbe {
  probe(target: string, opts: { deadlineMs: number; maxHops: number; signal?: AbortSignal }): Promise<RouteProbeResult>;
}

export function validateProbeInput(target: string, deadlineMs: number, maxHops: number): void {
  if (typeof target !== 'string' || target.length === 0) {
    throw new UsageError('mesh route requires a target scope id');
  }
  if (!Number.isInteger(deadlineMs) || deadlineMs < 100 || deadlineMs > 60_000) {
    throw new UsageError('--deadline-ms must be an integer in [100, 60000]');
  }
  if (!Number.isInteger(maxHops) || maxHops < 1 || maxHops > 16) {
    throw new UsageError('--max-hops must be an integer in [1, 16]');
  }
  if (deadlineMs <= 0) throw new TimeoutError('deadline already elapsed');
}
