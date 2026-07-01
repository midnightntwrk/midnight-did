import path from "node:path";
import { fileURLToPath } from "node:url";
export const resolveApiPackageRoot = (moduleUrl) => {
    const fileDir = path.dirname(fileURLToPath(moduleUrl));
    const parentDir = path.resolve(fileDir, "..");
    if (path.basename(parentDir) === "dist") {
        return path.resolve(parentDir, "..");
    }
    return parentDir;
};
export const createContractConfig = (apiPackageRoot) => ({
    privateStateStoreName: "did-private-state",
    zkConfigPath: path.resolve(apiPackageRoot, "..", "contract", "src", "managed", "did"),
});
export const currentDir = resolveApiPackageRoot(import.meta.url);
export const contractConfig = createContractConfig(currentDir);
//# sourceMappingURL=package-paths.js.map