// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const managedDir = path.resolve(rootDir, '..', 'src', 'managed');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    const next = content.replace(/\n\/\/# sourceMappingURL=.*$/m, '');
    if (next !== content) {
      fs.writeFileSync(fullPath, next, 'utf8');
    }
  }
}

if (fs.existsSync(managedDir)) {
  walk(managedDir);
}
