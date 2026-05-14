#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_SCRIPTS = ["lint", "build", "test", "coverage", "lint:fix"];

function fail(message) {
  console.error(message);
  process.exit(1);
}

const rootManifest = JSON.parse(readFileSync("package.json", "utf8"));
const workspaces = Array.isArray(rootManifest.workspaces) ? rootManifest.workspaces : [];

if (workspaces.length === 0) {
  fail("No workspaces configured in root package.json; cannot run workspace precheck.");
}

const knownDrift = {
  missingWorkspaceScripts: [],
  missingWorkspaces: [],
};

for (const workspace of workspaces) {
  const manifestPath = resolve(workspace, "package.json");
  if (!existsSync(manifestPath)) {
    knownDrift.missingWorkspaces.push(workspace);
    continue;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const scripts = manifest.scripts || {};
  const missingScripts = REQUIRED_SCRIPTS.filter((name) => !Object.prototype.hasOwnProperty.call(scripts, name));
  if (missingScripts.length > 0) {
    knownDrift.missingWorkspaceScripts.push({
      workspace,
      missingScripts,
    });
  }

  if (workspace === "contract") {
    if (!manifest.scripts?.contract) {
      knownDrift.missingWorkspaceScripts.push({
        workspace,
        missingScripts: ["contract"],
      });
    }
  }
}

if (knownDrift.missingWorkspaces.length > 0) {
  fail(
    `Missing workspace manifests detected: ${knownDrift.missingWorkspaces.join(", ")}`,
  );
}

if (knownDrift.missingWorkspaceScripts.length > 0) {
  const lines = knownDrift.missingWorkspaceScripts
    .map((entry) => `${entry.workspace}: ${entry.missingScripts.join(", ")}`)
    .join("\n  - ");
  fail(`Workspace drift detected (missing scripts):\n  - ${lines}`);
}

console.log("Workspace dependency precheck passed.");
