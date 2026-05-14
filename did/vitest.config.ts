import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "dist/**",
        "**/*.d.ts",
        "src/test/**",
        "**/*.test.ts",
        "src/test/ledger-to-domain.unit.test.ts",
        "eslint.config.mjs",
        "vitest.config.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 100,
        lines: 90,
      },
    },
  },
});
