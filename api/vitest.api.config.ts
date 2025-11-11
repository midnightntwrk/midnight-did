import { defineConfig } from 'vitest/config';

export default defineConfig({
  mode: 'node',
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Long running environment/integration tests
    testTimeout: 1000 * 60 * 45,
    deps: {
      interopDefault: true,
      inline: [
        /^@midnight-ntwrk\/compact-runtime(?:\/.*)?$/,
        /^@midnight-ntwrk\/onchain-runtime(?:\/.*)?$/,
      ],
      optimizer: {
        ssr: {
          include: [
            '@midnight-ntwrk/onchain-runtime/midnight_onchain_runtime_wasm_fs.js',
            '@midnight-ntwrk/onchain-runtime',
            '@midnight-ntwrk/compact-runtime',
          ],
        },
      },
    },
    globals: true,
    environment: 'node',
    include: ['src/test/did.api.test.ts'],
    root: '.',
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/test/**',
        '**/*.test.ts',
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
  ssr: {
    noExternal: [
      '@midnight-ntwrk/compact-runtime',
      '@midnight-ntwrk/onchain-runtime',
    ],
  },
});
