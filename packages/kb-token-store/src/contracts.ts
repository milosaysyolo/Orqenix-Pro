// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-003 Token Store Contracts
// @gate G18-pro

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';

export const CachedVerificationSchema = z.object({
  jti: z.string().min(1).max(128),
  scopeId: z.string().min(1),
  audienceScopeId: z.string().min(1),
  caps: z.array(z.string()).min(1).max(64),
  verifiedAt: z.string(),
  expiresAt: z.string(),
  signatureValid: z.literal(true),
  contextHash: z.string().min(1).max(64),
}).strict();
export type CachedVerification = z.infer<typeof CachedVerificationSchema>;

export interface TokenStoreStats {
  hits: number;
  misses: number;
  writes: number;
  expirations: number;
  size: number;
}

export class TokenStoreClosedError extends OrqenixError {
  constructor() { super('token store is closed', 'TOKEN_STORE_CLOSED'); }
}
export class TokenStoreCorruptError extends OrqenixError {
  constructor(reason: string) { super(`token store corrupt: ${reason}`, 'TOKEN_STORE_CORRUPT'); }
}
