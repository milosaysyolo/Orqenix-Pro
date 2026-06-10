export const BACKEND_KINDS = ['sqlite', 'lmdb', 'kuzu', 'lancedb'] as const;
export type BackendKind = (typeof BACKEND_KINDS)[number];

export interface BackendInfo {
  kind: BackendKind;
  active: boolean;
  ready: boolean;
  lastError?: string;
  version?: string;
}

export interface BackendManager {
  status(): Promise<BackendInfo[]>;
  readinessProbe(kind: BackendKind): Promise<boolean>;
  switch(kind: BackendKind): Promise<BackendInfo>;
}

export class PolyglotBackendManager implements BackendManager {
  async status(): Promise<BackendInfo[]> {
    return [];
  }

  async readinessProbe(_kind: BackendKind): Promise<boolean> {
    return false;
  }

  async switch(_kind: BackendKind): Promise<BackendInfo> {
    throw new Error('not implemented');
  }
}
