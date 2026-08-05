// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['src/managed/**', '**/*.test.ts', 'vitest.config.ts'],
      thresholds: {
        branches: 55,
        functions: 100,
        lines: 90,
        statements: 90,
      },
    },
  },
});
