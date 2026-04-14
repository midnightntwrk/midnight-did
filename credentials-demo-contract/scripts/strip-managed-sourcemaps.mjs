import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const managedContractPath = path.resolve(packageDir, "../src/managed/demo/contract/index.js");

const source = await fs.readFile(managedContractPath, "utf8");
const updated = source.replace(/\n\/\/# sourceMappingURL=.*$/m, "");

if (source !== updated) {
  await fs.writeFile(managedContractPath, updated, "utf8");
}
