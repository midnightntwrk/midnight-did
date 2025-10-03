import { defineConfig } from 'vitest/config';

export default defineConfig({
  mode: 'node',
  test: {
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 1000 * 60 * 45,
    deps: { interopDefault: true },
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules'],
    root: '.',
    reporters: ['default'],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    conditions: ['import', 'node', 'default'],
  },
});

