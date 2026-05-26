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
    console.warn(
      `[ensure-rollup-native] rollup is not resolvable from the workspace root; skipping native optional dependency repair: ${initial.message}`,
    );
    process.exit(0);
  }

  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(currentFile), "..");
  const install = spawnSync(
    "pnpm",
    [
      "install",
      "--ignore-scripts",
      "--config.engine-strict=false",
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    },
  );

  if (install.status !== 0) {
    process.exit(install.status ?? 1);
  }

  const repaired = resolveRollupNative();
  if (!repaired.ok) {
    throw new Error(
      [
        `Rollup native optional dependency is still missing after pnpm install: ${initial.missingPackage}`,
        "Run pnpm install --ignore-scripts --config.engine-strict=false and inspect the pnpm optional dependency output.",
        repaired.message,
      ].join("\n"),
    );
  }
}
