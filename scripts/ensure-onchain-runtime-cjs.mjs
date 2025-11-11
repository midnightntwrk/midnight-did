#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const runtimeDir = path.join(
  repoRoot,
  "node_modules",
  "@midnight-ntwrk",
  "onchain-runtime",
);
const sourceFile = path.join(
  repoRoot,
  "scripts",
  "patches",
  "midnight_onchain_runtime_wasm_fs.cjs",
);
const targetFile = path.join(
  runtimeDir,
  "midnight_onchain_runtime_wasm_fs.cjs",
);
const packageJsonPath = path.join(runtimeDir, "package.json");

async function ensureFileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyShim() {
  if (!(await ensureFileExists(runtimeDir))) {
    console.warn(
      "[ensure-onchain-runtime-cjs] @midnight-ntwrk/onchain-runtime is not installed; skipping shim copy.",
    );
    return false;
  }

  if (!(await ensureFileExists(sourceFile))) {
    throw new Error(
      `[ensure-onchain-runtime-cjs] Shim source not found at ${sourceFile}`,
    );
  }

  await fs.copyFile(sourceFile, targetFile);
  return true;
}

function ensureEntry(arr, value) {
  if (!Array.isArray(arr)) return [value];
  return arr.includes(value) ? arr : [...arr, value];
}

async function patchPackageJson() {
  const pkgBuffer = await fs.readFile(packageJsonPath, "utf8");
  const pkgJson = JSON.parse(pkgBuffer);

  pkgJson.files = ensureEntry(pkgJson.files, "midnight_onchain_runtime_wasm_fs.cjs");
  pkgJson.sideEffects = ensureEntry(
    pkgJson.sideEffects,
    "./midnight_onchain_runtime_wasm_fs.cjs",
  );

  if (!pkgJson.imports) pkgJson.imports = {};
  if (!pkgJson.imports["#self"]) pkgJson.imports["#self"] = {};
  pkgJson.imports["#self"].node = "./midnight_onchain_runtime_wasm_fs.cjs";

  if (!pkgJson.exports) pkgJson.exports = {};
  pkgJson.exports.node = "./midnight_onchain_runtime_wasm_fs.cjs";

  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(pkgJson, null, 2)}\n`,
    "utf8",
  );
}

async function main() {
  try {
    const copied = await copyShim();
    if (!copied) return;
    await patchPackageJson();
    console.info(
      "[ensure-onchain-runtime-cjs] Applied CommonJS shim for onchain runtime.",
    );
  } catch (error) {
    console.error(
      "[ensure-onchain-runtime-cjs] Failed to apply CommonJS shim:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  }
}

await main();
