import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const contractEntry = path.resolve(rootDir, '..', 'contract', 'dist', 'index.js');

export default defineConfig({
  mode: 'node',
  test: {
    // The wallet SDK imports web-worker, which treats worker_threads as web workers.
    pool: 'forks',
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
      reporter: ['text', 'json', 'html', 'lcov'],
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
      thresholds: {
        branches: 75,
        functions: 70,
        lines: 75,
        statements: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@midnight-ntwrk/midnight-did-contract': contractEntry,
    },
    extensions: ['.ts', '.js'],
    conditions: ['import', 'node', 'default'],
  },
});
