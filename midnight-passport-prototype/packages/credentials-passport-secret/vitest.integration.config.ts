import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/integration/**/*.integration.test.ts"],
    testTimeout: 600_000,
    hookTimeout: 600_000,
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
