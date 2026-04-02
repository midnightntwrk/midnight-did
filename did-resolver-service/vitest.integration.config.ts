import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const contractEntry = path.resolve(rootDir, "..", "contract", "dist", "index.js");

export default defineConfig({
  resolve: {
    alias: {
      "@midnight-ntwrk/midnight-did-contract": contractEntry,
    },
  },
  mode: "node",
  test: {
    include: ["src/test/integration/resolver.did-flow.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    globals: true,
    environment: "node",
    testTimeout: 1000 * 60 * 20,
    hookTimeout: 1000 * 60 * 20,
    reporters: ["default"],
  },
});
