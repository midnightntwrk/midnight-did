#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

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
  const didApiPackage = {
    name: "@midnight-ntwrk/midnight-did-api",
    version: "0.1.0",
  };
  const domainTarball = npmPackFileName(
    didDomainPackage.name,
    didDomainPackage.version,
  );
  const apiTarball = npmPackFileName(didApiPackage.name, didApiPackage.version);
  const domainFileSpec = `file:tooling/vendor/midnight-did/${domainTarball}`;

  writeJson(path.join(didRoot, "package.json"), {
    workspaces: ["packages/domain", "packages/api", "packages/missing"],
  });
  writeJson(
    path.join(didRoot, "packages/domain/package.json"),
    didDomainPackage,
  );
  writeText(path.join(didRoot, "packages/domain/dist/index.js"));
  writeJson(path.join(didRoot, "packages/api/package.json"), didApiPackage);
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
  assert.equal(report.siblingVc.summary.staleFileSpecCount, 0);
  assert.equal(report.siblingVc.summary.externalSpecCount, 0);
  assert.equal(report.siblingVc.summary.missingVendorTarballCount, 0);
  assert.equal(report.siblingVc.references[0].expectedFileSpec, domainFileSpec);

  const missingSiblingReport = buildIntegrationReport({
    repoRoot: didRoot,
    siblingVcRoot: path.join(fixtureRoot, "missing-vc"),
  });
  assert.equal(missingSiblingReport.siblingVc.present, false);
  assert.deepEqual(missingSiblingReport.warnings, [
    "Workspace package is missing package.json: packages/missing",
    "Sibling midnight-verifiable-credentials checkout was not found; VC reference checks skipped.",
  ]);

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

  writeJson(path.join(vcRoot, "packages/external/package.json"), {
    name: "external-did-consumer",
    dependencies: {
      [didDomainPackage.name]: "^0.1.0",
    },
  });

  const externalReport = buildIntegrationReport({
    repoRoot: didRoot,
    siblingVcRoot: vcRoot,
  });
  assert.deepEqual(externalReport.errors, []);
  assert.equal(externalReport.siblingVc.summary.referenceCount, 2);
  assert.equal(externalReport.siblingVc.summary.matchingFileSpecCount, 1);
  assert.equal(externalReport.siblingVc.summary.externalSpecCount, 1);

  writeJson(path.join(vcRoot, "packages/missing-tarball/package.json"), {
    name: "missing-tarball-consumer",
    dependencies: {
      [didApiPackage.name]: `file:../../tooling/vendor/midnight-did/${apiTarball}`,
    },
  });

  const missingTarballReport = buildIntegrationReport({
    repoRoot: didRoot,
    siblingVcRoot: vcRoot,
  });
  assert.equal(missingTarballReport.siblingVc.summary.referenceCount, 3);
  assert.equal(missingTarballReport.siblingVc.summary.matchingFileSpecCount, 2);
  assert.equal(missingTarballReport.siblingVc.summary.missingVendorTarballCount, 1);
  assert.match(
    missingTarballReport.errors.join("\n"),
    /missing-tarball-consumer references @midnight-ntwrk\/midnight-did-api, but vendor tarball is missing/u,
  );

  // The report walks all package.json files, not only declared workspaces, so
  // stale nested consumers remain visible during layout migrations.
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
  assert.match(failingCheck.stdout, /stale-file-specs=1/u);
  assert.match(failingCheck.stdout, /missing-vendor-tarballs=1/u);
  const staleReferenceReport = buildIntegrationReport({
    repoRoot: didRoot,
    siblingVcRoot: vcRoot,
  });
  assert.equal(
    staleReferenceReport.siblingVc.summary.referenceCount,
    staleReferenceReport.siblingVc.summary.matchingFileSpecCount +
      staleReferenceReport.siblingVc.summary.staleFileSpecCount +
      staleReferenceReport.siblingVc.summary.externalSpecCount,
  );
  assert.equal(staleReferenceReport.siblingVc.summary.missingVendorTarballCount, 1);
  const staleReference = staleReferenceReport.siblingVc.references.find(
    (reference) => reference.consumer === "stale-did-consumer",
  );
  assert.equal(staleReference.currentVendorTarballPresent, true);
  assert.equal(staleReference.referencedVendorTarballPresent, false);
  assert.equal("vendorTarballPresent" in staleReference, false);

  const unknownArg = spawnSync("node", [scriptPath, "--dryrun"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(unknownArg.status, 1, "unknown arguments should fail closed");
  assert.match(unknownArg.stderr, /Unknown report-integration argument: --dryrun/u);

  const helpWins = spawnSync("node", [scriptPath, "--help", "--dryrun"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(helpWins.status, 0, "help should win over unknown arguments");
  assert.match(helpWins.stdout, /Usage: node scripts\/report-integration\.mjs/u);
  assert.match(helpWins.stdout, /Stable ISO-8601 generatedAt timestamp/u);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("integration report contract checks passed.");
