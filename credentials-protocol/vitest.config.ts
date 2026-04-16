import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.ts"],
    exclude: ["src/test/integration/**"],
    testTimeout: 30_000,
  },
});
