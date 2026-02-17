import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "src/test/did-operations.test.ts",
        "src/test/domain-to-ledger.unit.test.ts",
        "src/test/ledger-to-domain.unit.test.ts",
        "eslint.config.mjs",
        "vitest.config.ts",
      ],
    },
  },
});
