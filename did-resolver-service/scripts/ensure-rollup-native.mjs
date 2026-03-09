import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const resolveRollupNative = () => {
  try {
    require("rollup/dist/native.js");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/Cannot find module (@rollup\/rollup-[\w-]+)/);
    return { ok: false, missingPackage: match?.[1] };
  }
};

const initial = resolveRollupNative();
if (!initial.ok) {
  if (!initial.missingPackage) {
    throw new Error("Rollup native optional dependency is missing");
  }

  const repoRoot = path.resolve(new URL(import.meta.url).pathname, "../../..");
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
