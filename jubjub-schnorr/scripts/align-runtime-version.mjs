// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(packageRoot, '..');
const runtimePackage = JSON.parse(
  await readFile(path.join(repoRoot, 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'package.json'), 'utf8'),
);
const runtimeVersion = runtimePackage.version;
const targetFile = path.join(packageRoot, 'src', 'managed', 'jubjub-schnorr', 'contract', 'index.js');
const targetTypesFile = path.join(packageRoot, 'src', 'managed', 'jubjub-schnorr', 'contract', 'index.d.ts');
const source = await readFile(targetFile, 'utf8');
let next = source.replace(/checkRuntimeVersion\('\d+\.\d+\.\d+'\);/, `checkRuntimeVersion('${runtimeVersion}');`);
const impureCircuitsPattern = /(\s*this\.impureCircuits = \{\n[\s\S]*?\n\s*\};\n)/;
if (!impureCircuitsPattern.test(next)) {
  throw new Error('align-runtime-version: failed to locate generated impureCircuits block');
}
next = next.replace(impureCircuitsPattern, `$1    this.provableCircuits = this.impureCircuits;\n`);
if (next !== source) {
  await writeFile(targetFile, next, 'utf8');
}

const typesSource = await readFile(targetTypesFile, 'utf8');
const impureCircuitsTypePattern = /(\s+impureCircuits: ImpureCircuits<PS>;\n)/;
if (!impureCircuitsTypePattern.test(typesSource)) {
  throw new Error('align-runtime-version: failed to locate generated impureCircuits type');
}
const nextTypes = typesSource.replace(impureCircuitsTypePattern, `$1  provableCircuits: ImpureCircuits<PS>;\n`);
if (nextTypes !== typesSource) {
  await writeFile(targetTypesFile, nextTypes, 'utf8');
}
