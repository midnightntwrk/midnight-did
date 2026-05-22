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
  INTEGRATION_REPORT_SCHEMA,
  npmPackFileName,
  printIntegrationReport,
  validateIntegrationReportContract,
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
  writeJson(path.join(vcRoot, "tooling/vendor/midnight-did/package.json"), {
    name: "ignored-vendor-metadata",
    dependencies: {
      [didDomainPackage.name]: "^999.0.0",
    },
  });

  const report = buildIntegrationReport({
    repoRoot: didRoot,
    siblingVcRoot: vcRoot,
    generatedAt: "2026-05-22T00:00:00.000Z",
  });

  assert.equal(report.generatedAt, "2026-05-22T00:00:00.000Z");
  assert.equal(report.schemaId, INTEGRATION_REPORT_SCHEMA.id);
  assert.equal(report.schemaVersion, INTEGRATION_REPORT_SCHEMA.version);
  assert.deepEqual(validateIntegrationReportContract(report), []);
  assert.deepEqual(report.contractErrors, []);
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
  assert.equal(report.siblingVc.summary.notes, undefined);
  assert.deepEqual(INTEGRATION_REPORT_SCHEMA.summaryCounterPolicy.notes, [
    "referenceCount is partitioned by matching-file-specs, stale-file-specs, and external-specs.",
    "missing-vendor-tarballs is independent and can overlap with stale or matching file specs.",
    "fileSpecMatchesCurrentVersion is null for external package specs because no file path is being compared.",
  ]);
  assert.equal(
    INTEGRATION_REPORT_SCHEMA.referenceKinds.length,
    INTEGRATION_REPORT_SCHEMA.summaryCounterPolicy.partitionedCounters.length,
    "each partitioned reference kind should have one summary counter",
  );
  assert.equal(report.siblingVc.references[0].referenceKind, "matching-file");
  assert.equal(report.siblingVc.references[0].fileSpecMatchesCurrentVersion, true);
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
  const externalReference = externalReport.siblingVc.references.find(
    (reference) => reference.consumer === "external-did-consumer",
  );
  assert.equal(externalReference.referenceKind, "external");
  assert.equal(externalReference.fileSpecMatchesCurrentVersion, null);
  assert.deepEqual(validateIntegrationReportContract(externalReport), []);

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
        MIDNIGHT_DID_INTEGRATION_NOW: "2026-05-22T00:00:00.000Z",
      },
    },
  );
  assert.equal(failingCheck.status, 1, "stale file specs should fail --check");
  assert.match(
    failingCheck.stdout,
    /expected file:\.\.\/\.\.\/tooling\/vendor\/midnight-did\/midnight-ntwrk-midnight-did-domain-0\.1\.0\.tgz/u,
  );
  assert.match(
    failingCheck.stderr,
    /\[report-integration\] Error: stale-did-consumer references @midnight-ntwrk\/midnight-did-domain/u,
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
  assert.equal(staleReferenceReport.errors.length, 2);
  assert.equal(staleReference.referenceKind, "stale-file");
  assert.equal(staleReference.fileSpecMatchesCurrentVersion, false);
  assert.equal(staleReference.currentVendorTarballPresent, true);
  assert.equal(staleReference.referencedVendorTarballPresent, false);
  assert.equal(staleReference.vendorTarballPresent, true);
  assert.deepEqual(validateIntegrationReportContract(staleReferenceReport), []);

  const schemaResult = spawnSync("node", [scriptPath, "--schema"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(schemaResult.status, 0, schemaResult.stderr);
  assert.deepEqual(JSON.parse(schemaResult.stdout), INTEGRATION_REPORT_SCHEMA);

  const contractErrorReport = {
    ...report,
    siblingVc: {
      ...report.siblingVc,
      references: [
        {
          ...report.siblingVc.references[0],
          referenceKind: "external",
          fileSpecMatchesCurrentVersion: true,
        },
      ],
    },
  };
  assert.deepEqual(validateIntegrationReportContract(contractErrorReport), [
    `${report.siblingVc.references[0].consumer} ${didDomainPackage.name} external reference must set fileSpecMatchesCurrentVersion=null`,
  ]);

  const baseReference = report.siblingVc.references[0];
  const baseSummary = report.siblingVc.summary;
  const reportWithReference = (reference, summary) => ({
    ...report,
    siblingVc: {
      ...report.siblingVc,
      references: [reference],
      summary,
    },
  });
  const matchingSummary = {
    ...baseSummary,
    referenceCount: 1,
    matchingFileSpecCount: 1,
    staleFileSpecCount: 0,
    externalSpecCount: 0,
  };
  const staleSummary = {
    ...baseSummary,
    referenceCount: 1,
    matchingFileSpecCount: 0,
    staleFileSpecCount: 1,
    externalSpecCount: 0,
  };

  const contractErrorCases = [
    {
      report: { ...report, schemaId: "wrong-schema" },
      errors: [
        `schemaId must be ${INTEGRATION_REPORT_SCHEMA.id}; received wrong-schema`,
      ],
    },
    {
      report: { ...report, schemaVersion: 999 },
      errors: [
        `schemaVersion must be ${INTEGRATION_REPORT_SCHEMA.version}; received 999`,
      ],
    },
    {
      report: {
        ...report,
        siblingVc: { ...report.siblingVc, summary: undefined },
      },
      errors: ["siblingVc.summary is required"],
    },
    {
      report: reportWithReference(
        { ...baseReference, referenceKind: "unsupported" },
        undefined,
      ),
      errors: [
        "siblingVc.summary is required",
        `${baseReference.consumer} ${baseReference.dependencyName} has unsupported referenceKind unsupported`,
      ],
    },
    {
      report: {
        ...report,
        siblingVc: {
          ...report.siblingVc,
          summary: {
            ...baseSummary,
            matchingFileSpecCount: undefined,
          },
        },
      },
      errors: [
        "summary.matchingFileSpecCount must be a finite number; received missing",
      ],
    },
    {
      report: {
        ...report,
        siblingVc: {
          ...report.siblingVc,
          summary: {
            ...baseSummary,
            matchingFileSpecCount: 0,
            staleFileSpecCount: 0,
            externalSpecCount: 0,
          },
        },
      },
      errors: [
        "summary partition counters must add up to referenceCount; received 0 for 1",
      ],
    },
    {
      report: {
        ...report,
        siblingVc: {
          ...report.siblingVc,
          summary: {
            ...baseSummary,
            referenceCount: 2,
            matchingFileSpecCount: 2,
          },
        },
      },
      errors: [
        "summary.referenceCount must match references.length; received 2 for 1",
      ],
    },
    {
      report: reportWithReference(
        { ...baseReference, referenceKind: "unsupported" },
        matchingSummary,
      ),
      errors: [
        `${baseReference.consumer} ${baseReference.dependencyName} has unsupported referenceKind unsupported`,
      ],
    },
    {
      report: reportWithReference(
        { ...baseReference, fileSpecMatchesCurrentVersion: false },
        matchingSummary,
      ),
      errors: [
        `${baseReference.consumer} ${baseReference.dependencyName} matching-file reference must set fileSpecMatchesCurrentVersion=true`,
      ],
    },
    {
      report: reportWithReference(
        {
          ...baseReference,
          referenceKind: "stale-file",
          fileSpecMatchesCurrentVersion: true,
        },
        staleSummary,
      ),
      errors: [
        `${baseReference.consumer} ${baseReference.dependencyName} stale-file reference must set fileSpecMatchesCurrentVersion=false`,
      ],
    },
  ];
  for (const contractErrorCase of contractErrorCases) {
    assert.deepEqual(
      validateIntegrationReportContract(contractErrorCase.report),
      contractErrorCase.errors,
    );
  }

  const originalConsoleLog = console.log;
  const printedLines = [];
  console.log = (line = "") => {
    printedLines.push(String(line));
  };
  try {
    assert.doesNotThrow(() =>
      printIntegrationReport({ ...report, contractErrors: undefined }),
    );
  } finally {
    console.log = originalConsoleLog;
  }
  assert.match(
    printedLines.join("\n"),
    /# DID Integration Report/u,
    "printer should still render hand-constructed reports without contractErrors",
  );
  printedLines.length = 0;
  console.log = (line = "") => {
    printedLines.push(String(line));
  };
  try {
    printIntegrationReport({ ...report, contractErrors: ["schema drift"] });
  } finally {
    console.log = originalConsoleLog;
  }
  assert.match(
    printedLines.join("\n"),
    /## Contract Errors\n- schema drift/u,
    "printer should render contract errors when present",
  );

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

  const conflictingSchemaMode = spawnSync(
    "node",
    [scriptPath, "--schema", "--check"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  assert.equal(
    conflictingSchemaMode.status,
    1,
    "schema mode should reject conflicting report execution flags",
  );
  assert.match(
    conflictingSchemaMode.stderr,
    /--schema cannot be combined with --check or --json/u,
  );
  const conflictingSchemaJsonMode = spawnSync(
    "node",
    [scriptPath, "--schema", "--json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  assert.equal(
    conflictingSchemaJsonMode.status,
    1,
    "schema mode should reject conflicting JSON report flags",
  );
  assert.match(
    conflictingSchemaJsonMode.stderr,
    /--schema cannot be combined with --check or --json/u,
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("integration report contract checks passed.");
