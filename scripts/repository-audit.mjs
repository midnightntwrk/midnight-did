#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");

const pkgPath = resolve("package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const workspaces = Array.isArray(pkg.workspaces) ? pkg.workspaces : [];

const requiredWorkspaceScripts = ["lint", "build", "test", "coverage", "lint:fix"];
const expectedOutOfScope = [
  "credentials",
  "credentials-birth",
  "credentials-birth-secret",
  "credentials-demo-contract",
  "credentials-iso-registry",
  "credentials-openid",
  "credentials-protocol",
  "credentials-same-holder",
  "did-manager-service",
  "midnight-passport-prototype",
  "secret-storage",
  "proof-server-bootstrap",
  "docs-site",
  "review",
  ".turbo",
];

const report = {
  timestamp: new Date().toISOString(),
  workspaceDirectoryCount: workspaces.length,
  workspaceChecks: [],
  boundaryChecks: {
    expectedOutOfScope: expectedOutOfScope,
    presentOutOfScope: [],
  },
  passed: true,
};

if (workspaces.length === 0) {
  report.passed = false;
  report.error = "No workspaces defined in package.json";
}

for (const workspace of workspaces) {
  const manifestPath = join(workspace, "package.json");
  const check = {
    workspace,
    manifestExists: existsSync(manifestPath),
    missingScripts: [],
    passed: true,
  };

  if (!check.manifestExists) {
    check.passed = false;
    report.passed = false;
    report.workspaceChecks.push(check);
    continue;
  }

  const workspacePkg = JSON.parse(readFileSync(manifestPath, "utf8"));
  const scripts = workspacePkg.scripts || {};
  for (const scriptName of requiredWorkspaceScripts) {
    if (!Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
      check.missingScripts.push(scriptName);
      check.passed = false;
      report.passed = false;
    }
  }

  report.workspaceChecks.push(check);
}

for (const candidate of expectedOutOfScope) {
  if (existsSync(candidate)) {
    const stat = statSync(candidate);
    if (stat.isDirectory()) {
      report.boundaryChecks.presentOutOfScope.push(candidate);
    }
  }
}

if (!asJson) {
  console.log("Repository Audit");
  console.log(`timestamp=${report.timestamp}`);
  console.log(`workspaces=${report.workspaceDirectoryCount}`);
  console.log(`passed=${report.passed}`);
  for (const check of report.workspaceChecks) {
    if (check.passed) {
      console.log(`workspace:${check.workspace}=ok`);
      continue;
    }

    if (!check.manifestExists) {
      console.log(`workspace:${check.workspace}=missing-manifest`);
      continue;
    }

    console.log(`workspace:${check.workspace}=missing-scripts:${check.missingScripts.join(",")}`);
  }

  if (report.boundaryChecks.presentOutOfScope.length > 0) {
    console.log("legacy-directories:");
    for (const dir of report.boundaryChecks.presentOutOfScope) {
      console.log(`- ${dir}`);
    }
  }

  process.exit(report.passed ? 0 : 1);
}

console.log(JSON.stringify(report, null, 2));
if (!report.passed) {
  process.exit(1);
}
