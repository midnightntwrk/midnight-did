import { defineConfig } from 'vitest/config';

export default defineConfig({
  mode: 'node',
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Long running environment/integration tests
    testTimeout: 1000 * 60 * 45,
    deps: {
      interopDefault: true,
    },
    globals: true,
    environment: 'node',
    include: ['src/test/did.api.test.ts'],
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
      // Integration coverage is intentionally a narrow live-flow smoke gate;
      // the unit config carries the package-wide API coverage threshold.
      thresholds: {
        statements: 20,
        branches: 20,
        functions: 20,
        lines: 20,
      },
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
    conditions: ['import', 'node', 'default'],
  },
  ssr: {},
});
