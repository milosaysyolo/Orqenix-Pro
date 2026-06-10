export const BACKEND_KINDS = ['sqlite', 'lmdb', 'kuzu', 'lancedb'] as const;
export type BackendKind = (typeof BACKEND_KINDS)[number];

export function isBackendKind(s: string): s is BackendKind {
  return (BACKEND_KINDS as readonly string[]).includes(s);
}

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
