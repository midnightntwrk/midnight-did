import { defineConfig } from "vitest/config";

export default defineConfig({
  mode: "node",
  test: {
    include: ["src/test/**/*.test.ts"],
    exclude: ["src/test/integration/**"],
    globals: true,
    environment: "node",
    reporters: ["default"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/test/**"],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
