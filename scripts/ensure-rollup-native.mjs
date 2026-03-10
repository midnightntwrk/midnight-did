#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const resolveRollupNative = () => {
  try {
    require("rollup/dist/native.js");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/Cannot find module (@rollup\/rollup-[\w-]+)/);
    return { ok: false, missingPackage: match?.[1], message };
  }
};

const initial = resolveRollupNative();
if (!initial.ok) {
  if (!initial.missingPackage) {
    throw new Error(
      `Rollup native optional dependency is missing: ${initial.message}`,
    );
  }

  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(currentFile), "..");
  const install = spawnSync(
    "npm",
    [
      "install",
      "--no-save",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      initial.missingPackage,
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, npm_config_engine_strict: "false" },
    },
  );

  if (install.status !== 0) {
    process.exit(install.status ?? 1);
  }
}
