// SPDX-License-Identifier: BUSL-1.1
// @bc CS-pro-007 Blast Radius Schema
// @gate G37-pro.1

import type { MigrationRecord } from '@orqenix/storage-sqlite';

const M001 = `
CREATE TABLE IF NOT EXISTS blast_radius_quotas (
  scope_id    TEXT NOT NULL,
  kind        TEXT NOT NULL,
  limit_value INTEGER NOT NULL,
  window_ms   INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (scope_id, kind)
) STRICT;

CREATE TABLE IF NOT EXISTS blast_radius_usage (
  scope_id     TEXT NOT NULL,
  kind         TEXT NOT NULL,
  window_start TEXT NOT NULL,
  consumed     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope_id, kind, window_start)
) STRICT;

CREATE INDEX IF NOT EXISTS blast_radius_usage_recent
  ON blast_radius_usage (scope_id, kind, window_start DESC);
`;

export const BLAST_RADIUS_MIGRATIONS: MigrationRecord[] = [
  { id: 150, name: 'blast_radius_v1', sql: M001, checksum: '' },
];
