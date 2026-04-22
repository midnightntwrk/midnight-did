import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["src/test/integration/**/*.integration.test.ts"],
  },
});
