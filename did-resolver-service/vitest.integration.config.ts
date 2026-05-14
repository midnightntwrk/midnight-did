import { defineConfig } from "vitest/config";

export default defineConfig({
  mode: "node",
  test: {
    include: [
      "src/test/integration/resolver.did-flow.test.ts",
      "src/test/integration/resolver.container.test.ts",
    ],
    fileParallelism: false,
    maxWorkers: 1,
    globals: true,
    environment: "node",
    testTimeout: 1000 * 60 * 20,
    hookTimeout: 1000 * 60 * 20,
    reporters: ["default"],
  },
});
