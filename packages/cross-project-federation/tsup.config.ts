// SPDX-License-Identifier: BUSL-1.1
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  external: ['@orqenix/self-learning-detection', '@orqenix-pro/self-learning-advanced'],
  banner: { js: '// @orqenix-pro/cross-project-federation , BSL-1.1 → Apache-2.0 (4yr) , https://orqenix.dev' },
});
