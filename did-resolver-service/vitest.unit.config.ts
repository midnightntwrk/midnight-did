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
    include: ["src/test/**/*.test.ts"],
    exclude: ["src/test/integration/**"],
    globals: true,
    environment: "node",
    reporters: ["default"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/test/**", "**/*.d.ts", "src/types.ts"],
    },
  },
});
