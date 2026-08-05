import { defineConfig } from "vitest/config";

export default defineConfig({
  mode: "node",
  test: {
    // The Compact runtime WASM loader is not safe under Vitest worker threads
    // on Node 24: repeated ESM loads emit unmanaged FD warnings and can abort.
    // Forked workers isolate the loader and keep local validation stable.
    pool: "forks",
    fileParallelism: false,
    deps: { interopDefault: true },
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules"],
    root: ".",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: [
        "src/**/*.ts",
      ],
      exclude: [
        "src/test/**",
        "src/test/**/*",
        "src/test/**/*.ts",
        "src/test/fixtures/**",
        "**/*.test.ts",
        "src/index.ts",
        "vitest.config.ts"
      ],
      thresholds: {
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 90
      }
    }
  },
  server: {
    fs: {
      // Allow importing files from the monorepo root (contract sources)
      allow: [".."],
    },
  },
  resolve: {
    alias: {
      "@contract": "../contract/dist",
    },
  }
});
