#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const workspaces = Array.isArray(pkg.workspaces) ? pkg.workspaces : [];

if (workspaces.length === 0) {
  throw new Error("No workspaces defined in package.json");
}

const missing = workspaces.filter((ws) => !existsSync(join(ws, "package.json")));
if (missing.length > 0) {
  console.error("Missing workspace package.json files:");
  for (const ws of missing) {
    console.error(`- ${ws}/package.json`);
  }
  process.exit(1);
}

console.log("Workspace manifests validated:");
for (const ws of workspaces) {
  console.log(`- ${ws}`);
}
