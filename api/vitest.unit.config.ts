import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

export default defineConfig({
  mode: 'node',
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Unit tests only; keep a modest timeout
    testTimeout: 30_000,
    deps: { interopDefault: true },
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'src/test/did.api.test.ts'],
    root: '.',
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'dist/**',
        '**/*.d.ts',
        'src/test/**',
        '**/*.test.ts',
        'src/index.ts',
        'eslint.config.mjs',
        'vitest.config.ts',
        'vitest.unit.config.ts',
        'vitest.api.config.ts',
      ],
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
    conditions: ['import', 'node', 'default'],
  },
});
