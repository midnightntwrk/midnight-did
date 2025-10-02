import { defineConfig } from "vitest/config";

export default defineConfig({
  mode: "node",
  test: {
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    deps: { interopDefault: true },
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules"],
    root: ".",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "src/test/**",
        "src/index.ts",
        "vitest.config.ts"
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
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
