import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const findRepoRoot = async (startDir) => {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'package.json');
    try {
      await access(candidate);
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        throw new Error('Unable to locate node_modules/@midnight-ntwrk/compact-runtime/package.json');
      }
      current = parent;
    }
  }
};
const repoRoot = await findRepoRoot(packageRoot);
const runtimePackage = JSON.parse(
  await readFile(path.join(repoRoot, 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'package.json'), 'utf8'),
);
const runtimeVersion = runtimePackage.version;
const targetFile = path.join(
  packageRoot,
  'src',
  'managed',
  'secret-passport-credential',
  'contract',
  'index.js',
);
const targetTypesFile = path.join(
  packageRoot,
  'src',
  'managed',
  'secret-passport-credential',
  'contract',
  'index.d.ts',
);
const source = await readFile(targetFile, 'utf8');
let next = source.replace(
  /checkRuntimeVersion\('\d+\.\d+\.\d+'\);/,
  `checkRuntimeVersion('${runtimeVersion}');`,
);
next = next.replace(
  /(\s*this\.impureCircuits = \{\n[\s\S]*?\n\s*\};\n)/,
  `$1    this.provableCircuits = this.impureCircuits;\n`,
);
if (next !== source) {
  await writeFile(targetFile, next, 'utf8');
}

const typesSource = await readFile(targetTypesFile, 'utf8');
const nextTypes = typesSource.replace(
  /(\s+impureCircuits: ImpureCircuits<PS>;\n)/,
  `$1  provableCircuits: ImpureCircuits<PS>;\n`,
);
if (nextTypes !== typesSource) {
  await writeFile(targetTypesFile, nextTypes, 'utf8');
}
