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
        "src/did-registrar.ts",
        "src/did-resolver.ts",
        "vitest.config.ts"
      ],
      thresholds: {
        branches: 69,
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
