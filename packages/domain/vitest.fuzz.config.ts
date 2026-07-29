import { defineConfig } from "vitest/config";

export default defineConfig({
  mode: "node",
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
  server: {
    fs: {
      allow: [".."],
    },
  },
  resolve: {
    alias: {
      "@contract": "../contract/dist",
    },
  },
});
