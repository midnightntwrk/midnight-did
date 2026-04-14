import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(packageDir, "..");
const runtimePackageJsonPath = path.resolve(
  projectDir,
  "../node_modules/@midnight-ntwrk/compact-runtime/package.json",
);
const managedIndexPath = path.resolve(projectDir, "src/managed/demo/contract/index.js");

const runtimePackageJson = JSON.parse(
  await fs.readFile(runtimePackageJsonPath, "utf8"),
);
const runtimeVersion = runtimePackageJson.version;

const managedIndex = await fs.readFile(managedIndexPath, "utf8");
const updatedManagedIndex = managedIndex.replace(
  /__compactRuntime\.checkRuntimeVersion\('.*?'\);/,
  `__compactRuntime.checkRuntimeVersion('${runtimeVersion}');`,
);

if (managedIndex !== updatedManagedIndex) {
  await fs.writeFile(managedIndexPath, updatedManagedIndex, "utf8");
}
