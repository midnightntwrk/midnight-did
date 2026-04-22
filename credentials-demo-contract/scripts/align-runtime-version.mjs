import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(packageDir, "..");
const runtimePackageJsonPath = path.resolve(
  projectDir,
  "../node_modules/@midnight-ntwrk/compact-runtime/package.json",
);

const runtimePackageJson = JSON.parse(
  await fs.readFile(runtimePackageJsonPath, "utf8"),
);
const runtimeVersion = runtimePackageJson.version;

const managedDir = path.resolve(projectDir, "src/managed");
const managedIndexPaths = [];

const collectManagedIndexPaths = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectManagedIndexPaths(entryPath);
    } else if (entry.name === "index.js") {
      managedIndexPaths.push(entryPath);
    }
  }
};

await collectManagedIndexPaths(managedDir);

for (const managedIndexPath of managedIndexPaths) {
  const managedIndex = await fs.readFile(managedIndexPath, "utf8");
  const updatedManagedIndex = managedIndex.replace(
    /__compactRuntime\.checkRuntimeVersion\('.*?'\);/,
    `__compactRuntime.checkRuntimeVersion('${runtimeVersion}');`,
  );

  if (managedIndex !== updatedManagedIndex) {
    await fs.writeFile(managedIndexPath, updatedManagedIndex, "utf8");
  }
}
