// SPDX-License-Identifier: BUSL-1.1
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { name: 'memory-distiller-llm', include: ['test/**/*.test.ts'], environment: 'node', testTimeout: 30_000 } });
