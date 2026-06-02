// SPDX-License-Identifier: BUSL-1.1
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { name: 'mesh-delegation', include: ['test/**/*.test.ts'], environment: 'node', testTimeout: 15_000 } });
