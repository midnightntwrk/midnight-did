import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const managedDir = path.resolve(packageDir, "../src/managed");
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

for (const managedContractPath of managedIndexPaths) {
  const source = await fs.readFile(managedContractPath, "utf8");
  const updated = source.replace(/\n\/\/# sourceMappingURL=.*$/m, "");

  if (source !== updated) {
    await fs.writeFile(managedContractPath, updated, "utf8");
  }
}
