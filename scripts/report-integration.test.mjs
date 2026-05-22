#!/usr/bin/env node
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildIntegrationReport,
  npmPackFileName,
} from "./report-integration.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptPath = path.join(repoRoot, "scripts/report-integration.mjs");

const writeJson = (absolutePath, value) => {
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeText = (absolutePath, value = "") => {
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, value, "utf8");
};

const fixtureRoot = mkdtempSync(path.join(tmpdir(), "did-integration-report-"));

try {
  const didRoot = path.join(fixtureRoot, "midnight-did");
  const vcRoot = path.join(fixtureRoot, "midnight-verifiable-credentials");
  const didDomainPackage = {
    name: "@midnight-ntwrk/midnight-did-domain",
    version: "0.1.0",
  };
  const domainTarball = npmPackFileName(
    didDomainPackage.name,
    didDomainPackage.version,
  );
  const domainFileSpec = `file:tooling/vendor/midnight-did/${domainTarball}`;

  writeJson(path.join(didRoot, "package.json"), {
    workspaces: ["packages/domain", "packages/api", "packages/missing"],
  });
  writeJson(
    path.join(didRoot, "packages/domain/package.json"),
    didDomainPackage,
  );
  writeText(path.join(didRoot, "packages/domain/dist/index.js"));
  writeJson(path.join(didRoot, "packages/api/package.json"), {
    name: "@midnight-ntwrk/midnight-did-api",
    version: "0.1.0",
  });
  writeJson(path.join(vcRoot, "package.json"), {
    name: "midnight-vc-fixture",
    dependencies: {
      [didDomainPackage.name]: domainFileSpec,
    },
  });
  writeText(path.join(vcRoot, "tooling/vendor/midnight-did", domainTarball));

  const report = buildIntegrationReport({
    repoRoot: didRoot,
    siblingVcRoot: vcRoot,
    generatedAt: "2026-05-22T00:00:00.000Z",
  });

  assert.equal(report.generatedAt, "2026-05-22T00:00:00.000Z");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.warnings, [
    "Workspace package is missing package.json: packages/missing",
  ]);
  assert.equal(report.packages.length, 2);
  assert.equal(report.siblingVc.summary.referenceCount, 1);
  assert.equal(report.siblingVc.summary.matchingFileSpecCount, 1);
  assert.equal(report.siblingVc.summary.missingVendorTarballCount, 0);
  assert.equal(report.siblingVc.references[0].expectedFileSpec, domainFileSpec);

  const checkResult = spawnSync(
    "node",
    [scriptPath, "--json", "--check"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        MIDNIGHT_DID_REPO_ROOT: didRoot,
        MIDNIGHT_DID_SIBLING_VC_ROOT: vcRoot,
        MIDNIGHT_DID_INTEGRATION_NOW: "2026-05-22T00:00:00.000Z",
      },
    },
  );
  assert.equal(checkResult.status, 0, checkResult.stderr);
  assert.equal(JSON.parse(checkResult.stdout).siblingVc.summary.referenceCount, 1);

  writeJson(path.join(vcRoot, "packages/consumer/package.json"), {
    name: "stale-did-consumer",
    dependencies: {
      [didDomainPackage.name]:
        "file:../../tooling/vendor/midnight-did/midnight-ntwrk-midnight-did-domain-0.0.1.tgz",
    },
  });

  const failingCheck = spawnSync(
    "node",
    [scriptPath, "--check"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        MIDNIGHT_DID_REPO_ROOT: didRoot,
        MIDNIGHT_DID_SIBLING_VC_ROOT: vcRoot,
      },
    },
  );
  assert.equal(failingCheck.status, 1, "stale file specs should fail --check");
  assert.match(
    failingCheck.stdout,
    /expected file:\.\.\/\.\.\/tooling\/vendor\/midnight-did\/midnight-ntwrk-midnight-did-domain-0\.1\.0\.tgz/u,
  );

  const unknownArg = spawnSync("node", [scriptPath, "--dryrun"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(unknownArg.status, 1, "unknown arguments should fail closed");
  assert.match(unknownArg.stderr, /Unknown report-integration argument: --dryrun/u);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("integration report contract checks passed.");
