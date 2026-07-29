import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    fileParallelism: false,
    deps: { interopDefault: true },
    globals: true,
    environment: "node",
    include: ["fuzz/**/*.fuzz.ts"],
    exclude: ["node_modules"],
    root: ".",
  },
});
