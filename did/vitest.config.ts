import { defineConfig } from "vitest/config";

export default defineConfig({
  mode: "node",
  test: {
    pool: "threads",
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
        "**/*.test.ts",
        "src/index.ts",
        "eslint.config.mjs",
        "vitest.config.ts",
      ],
    },
  },
});
