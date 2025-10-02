// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { defineConfig } from "vitest/config";
const skipRuntime = !!process.env.SKIP_RUNTIME_TESTS;

export default defineConfig({
  mode: "node",
  test: {
    // Use worker_threads with a single thread to avoid sandboxed process kill issues
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    deps: {
      interopDefault: true
    },
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: [
      "node_modules",
      ...(skipRuntime
        ? [
            "src/test/also-known-as.test.ts",
            "src/test/domain-to-ledger.test.ts",
            "src/test/ledger-operation-builder.test.ts",
            "src/test/ledger-to-domain.test.ts",
            "src/test/midnight-did-state.test.ts",
          ]
        : []),
    ],
    root: ".",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "src/test/**",
        "src/index.ts",
        "src/did.compact",
        "src/did-registrar.ts",
        "src/did-resolver.ts",
        "eslint.config.mjs",
        "vitest.config.ts",
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
      }
    },
    reporters: ["default", ["junit", { outputFile: "reports/report.xml" }]]
  },
  resolve: {
    extensions: [".ts", ".js"],
    conditions: ["import", "node", "default"]
  }
});
