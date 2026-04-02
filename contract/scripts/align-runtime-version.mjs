import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const contractRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(contractRoot, '..');
const runtimePackage = JSON.parse(
  await readFile(path.join(repoRoot, 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'package.json'), 'utf8'),
);
const runtimeVersion = runtimePackage.version;
const targetFile = path.join(contractRoot, 'src', 'managed', 'did', 'contract', 'index.js');
const targetTypesFile = path.join(contractRoot, 'src', 'managed', 'did', 'contract', 'index.d.ts');
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
  console.log(
    `[align-runtime-version] Updated managed contract runtime guard to ${runtimeVersion} and aliased provableCircuits`,
  );
} else {
  console.log(
    '[align-runtime-version] Managed contract runtime guard and provableCircuits alias already aligned',
  );
}

const typesSource = await readFile(targetTypesFile, 'utf8');
const nextTypes = typesSource.replace(
  /(\s+impureCircuits: ImpureCircuits<PS>;\n)/,
  `$1  provableCircuits: ImpureCircuits<PS>;\n`,
);
if (nextTypes !== typesSource) {
  await writeFile(targetTypesFile, nextTypes, 'utf8');
}
