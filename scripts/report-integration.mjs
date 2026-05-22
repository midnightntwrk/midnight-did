#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const usage = `Usage: node scripts/report-integration.mjs [--check] [--json] [--schema] [-h|--help]

Print DID package readiness and sibling midnight-verifiable-credentials
references.

Summary counters partition references by matching/stale/external specs; missing
vendor tarballs are an independent error dimension.

Modes:
  --schema prints the schema descriptor only and cannot be combined with --check or --json.

Environment overrides for tests and workspace automation:
  MIDNIGHT_DID_REPO_ROOT          DID repository root to inspect.
  MIDNIGHT_DID_SIBLING_VC_ROOT    VC repository root to inspect.
  MIDNIGHT_DID_INTEGRATION_NOW    Stable ISO-8601 generatedAt timestamp.
`;
export const INTEGRATION_REPORT_SCHEMA = Object.freeze({
  id: "midnight-did-integration-report",
  version: 1,
  referenceKinds: Object.freeze(["matching-file", "stale-file", "external"]),
  summaryCounterPolicy: Object.freeze({
    partitionedCounters: Object.freeze([
      "matchingFileSpecCount",
      "staleFileSpecCount",
      "externalSpecCount",
    ]),
    independentCounters: Object.freeze(["missingVendorTarballCount"]),
    notes: Object.freeze([
      "referenceCount is partitioned by matching-file-specs, stale-file-specs, and external-specs.",
      "missing-vendor-tarballs is independent and can overlap with stale or matching file specs.",
      "fileSpecMatchesCurrentVersion is null for external package specs because no file path is being compared.",
    ]),
  }),
});

const DID_VENDOR_RELATIVE_ROOT = "tooling/vendor/midnight-did";

const defaultRepoRoot = () =>
  execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();

const readJson = (absolutePath) =>
  JSON.parse(readFileSync(absolutePath, "utf8"));

const formatCounterValue = (value) =>
  value === undefined ? "missing" : JSON.stringify(value);

export const npmPackFileName = (packageName, version) =>
  `${packageName.replace(/^@/u, "").replaceAll("/", "-")}-${version}.tgz`;

const gitValue = (repoRoot, args) => {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

const findPackageJsonFiles = (root) => {
  const results = [];
  const skip = new Set([".git", "node_modules", "dist", "coverage", "reports", "target"]);

  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        const relativeDirectory = path.relative(root, absolutePath).split(path.sep).join("/");
        if (!skip.has(entry.name) && relativeDirectory !== DID_VENDOR_RELATIVE_ROOT) {
          walk(absolutePath);
        }
        continue;
      }

      if (entry.isFile() && entry.name === "package.json") {
        results.push(absolutePath);
      }
    }
  };

  if (existsSync(root)) {
    walk(root);
  }

  return results.sort();
};

const collectDidPackages = (repoRoot, warnings) => {
  const rootPackagePath = path.join(repoRoot, "package.json");
  if (!existsSync(rootPackagePath)) {
    throw new Error(`DID repository root is missing package.json: ${repoRoot}`);
  }

  const rootPackage = readJson(rootPackagePath);
  const didPackages = new Map();

  for (const workspacePath of rootPackage.workspaces ?? []) {
    const packageJsonPath = path.join(repoRoot, workspacePath, "package.json");
    if (!existsSync(packageJsonPath)) {
      warnings.push(`Workspace package is missing package.json: ${workspacePath}`);
      continue;
    }

    const packageJson = readJson(packageJsonPath);
    if (packageJson.name?.startsWith("@midnight-ntwrk/midnight-did")) {
      didPackages.set(packageJson.name, {
        name: packageJson.name,
        version: packageJson.version,
        path: workspacePath,
        tarball: npmPackFileName(packageJson.name, packageJson.version),
        distIndex: existsSync(path.join(repoRoot, workspacePath, "dist/index.js")),
        managedIndex: existsSync(path.join(repoRoot, workspacePath, "src/managed")),
      });
    }
  }

  return [...didPackages.values()].sort((a, b) => a.name.localeCompare(b.name));
};

const collectSiblingVcReferences = ({
  didPackages,
  siblingVcRoot,
  didVendorRoot,
  errors,
  warnings,
}) => {
  const didPackageByName = new Map(
    didPackages.map((didPackage) => [didPackage.name, didPackage]),
  );
  const siblingVc = {
    path: siblingVcRoot,
    present: existsSync(path.join(siblingVcRoot, "package.json")),
    references: [],
    vendorTarballs: [],
    summary: {
      referenceCount: 0,
      matchingFileSpecCount: 0,
      staleFileSpecCount: 0,
      missingVendorTarballCount: 0,
      externalSpecCount: 0,
    },
  };

  if (!siblingVc.present) {
    warnings.push("Sibling midnight-verifiable-credentials checkout was not found; VC reference checks skipped.");
    return siblingVc;
  }

  if (existsSync(didVendorRoot)) {
    siblingVc.vendorTarballs = readdirSync(didVendorRoot)
      .filter((entry) => entry.endsWith(".tgz"))
      .sort();
  }

  for (const packageJsonPath of findPackageJsonFiles(siblingVcRoot)) {
    const packageJson = readJson(packageJsonPath);
    const dependencyScopes = [
      packageJson.dependencies ?? {},
      packageJson.devDependencies ?? {},
      packageJson.peerDependencies ?? {},
      packageJson.optionalDependencies ?? {},
    ];

    for (const dependencies of dependencyScopes) {
      for (const [dependencyName, spec] of Object.entries(dependencies)) {
        if (!didPackageByName.has(dependencyName)) {
          continue;
        }

        const didPackage = didPackageByName.get(dependencyName);
        const expectedTarball = didPackage.tarball;
        const expectedFileSpec = `file:${path.relative(path.dirname(packageJsonPath), path.join(didVendorRoot, expectedTarball)).split(path.sep).join("/")}`;
        const isFileSpec = spec.startsWith("file:");
        const fileSpecMatchesCurrentVersion = isFileSpec
          ? spec === expectedFileSpec
          : null;
        const referencedFileName = isFileSpec
          ? spec.slice("file:".length).split("/").filter(Boolean).at(-1)
          : null;
        const referencedTarball = referencedFileName?.endsWith(".tgz")
          ? referencedFileName
          : null;
        const vcRelativePackageJson = path.relative(siblingVcRoot, packageJsonPath);
        const currentVendorTarballPresent =
          siblingVc.vendorTarballs.includes(expectedTarball);
        const reference = {
          dependencyName,
          spec,
          expectedFileSpec,
          expectedTarball,
          referencedTarball,
          referenceKind:
            fileSpecMatchesCurrentVersion === true
              ? "matching-file"
              : isFileSpec
                ? "stale-file"
                : "external",
          consumer: packageJson.name ?? vcRelativePackageJson,
          packageJson: vcRelativePackageJson,
          fileSpecMatchesCurrentVersion,
          currentVendorTarballPresent,
          referencedVendorTarballPresent: referencedTarball
            ? siblingVc.vendorTarballs.includes(referencedTarball)
            : null,
          vendorTarballPresent: currentVendorTarballPresent,
        };

        siblingVc.references.push(reference);

        if (reference.referenceKind === "matching-file") {
          siblingVc.summary.matchingFileSpecCount += 1;
        } else if (reference.referenceKind === "external") {
          siblingVc.summary.externalSpecCount += 1;
        } else {
          siblingVc.summary.staleFileSpecCount += 1;
        }

        if (reference.referenceKind === "stale-file") {
          errors.push(
            `${reference.consumer} references ${dependencyName} as ${spec}; expected ${expectedFileSpec}`,
          );
        }

        if (isFileSpec && !reference.currentVendorTarballPresent) {
          siblingVc.summary.missingVendorTarballCount += 1;
          errors.push(
            `${reference.consumer} references ${dependencyName}, but vendor tarball is missing: ${expectedTarball}`,
          );
        }
      }
    }
  }

  siblingVc.references.sort((a, b) =>
    `${a.packageJson}:${a.dependencyName}`.localeCompare(
      `${b.packageJson}:${b.dependencyName}`,
    ),
  );
  siblingVc.summary.referenceCount = siblingVc.references.length;

  return siblingVc;
};

export const buildIntegrationReport = ({
  repoRoot = process.env.MIDNIGHT_DID_REPO_ROOT
    ? path.resolve(process.env.MIDNIGHT_DID_REPO_ROOT)
    : defaultRepoRoot(),
  siblingVcRoot = process.env.MIDNIGHT_DID_SIBLING_VC_ROOT
    ? path.resolve(process.env.MIDNIGHT_DID_SIBLING_VC_ROOT)
    : path.resolve(repoRoot, "..", "midnight-verifiable-credentials"),
  generatedAt = process.env.MIDNIGHT_DID_INTEGRATION_NOW ?? new Date().toISOString(),
} = {}) => {
  const errors = [];
  const warnings = [];
  const didVendorRoot = path.join(siblingVcRoot, DID_VENDOR_RELATIVE_ROOT);
  const packages = collectDidPackages(repoRoot, warnings);
  const siblingVc = collectSiblingVcReferences({
    didPackages: packages,
    siblingVcRoot,
    didVendorRoot,
    errors,
    warnings,
  });

  const draftReport = {
    schemaId: INTEGRATION_REPORT_SCHEMA.id,
    schemaVersion: INTEGRATION_REPORT_SCHEMA.version,
    repository: "midnight-did",
    generatedAt,
    git: {
      branch: gitValue(repoRoot, ["branch", "--show-current"]),
      commit: gitValue(repoRoot, ["rev-parse", "--short", "HEAD"]),
    },
    packages,
    siblingVc,
    errors,
    warnings,
  };
  return {
    ...draftReport,
    contractErrors: validateIntegrationReportContract(draftReport),
  };
};

export const validateIntegrationReportContract = (report) => {
  const contractErrors = [];
  const allowedReferenceKinds = new Set(INTEGRATION_REPORT_SCHEMA.referenceKinds);

  // buildIntegrationReport() sets these from the same constants. These checks
  // are for hand-constructed reports, stale JSON fixtures, and downstream tools.
  if (report.schemaId !== INTEGRATION_REPORT_SCHEMA.id) {
    contractErrors.push(
      `schemaId must be ${INTEGRATION_REPORT_SCHEMA.id}; received ${report.schemaId ?? "missing"}`,
    );
  }

  if (report.schemaVersion !== INTEGRATION_REPORT_SCHEMA.version) {
    contractErrors.push(
      `schemaVersion must be ${INTEGRATION_REPORT_SCHEMA.version}; received ${report.schemaVersion ?? "missing"}`,
    );
  }

  const references = report.siblingVc?.references ?? [];
  const summary = report.siblingVc?.summary;
  if (!summary) {
    contractErrors.push("siblingVc.summary is required");
    return contractErrors;
  }

  const requiredSummaryCounters = [
    "referenceCount",
    ...INTEGRATION_REPORT_SCHEMA.summaryCounterPolicy.partitionedCounters,
  ];
  for (const counterName of requiredSummaryCounters) {
    if (!Number.isFinite(summary[counterName])) {
      contractErrors.push(
        `summary.${counterName} must be a finite number; received ${formatCounterValue(summary[counterName])}`,
      );
    }
  }

  const summaryCountersAreFinite = requiredSummaryCounters.every((counterName) =>
    Number.isFinite(summary[counterName]),
  );
  const partitionedReferenceCount = summaryCountersAreFinite
    ? INTEGRATION_REPORT_SCHEMA.summaryCounterPolicy.partitionedCounters.reduce(
        (total, counterName) => total + summary[counterName],
        0,
      )
    : null;
  if (
    summaryCountersAreFinite &&
    partitionedReferenceCount !== summary.referenceCount
  ) {
    contractErrors.push(
      `summary partition counters must add up to referenceCount; received ${partitionedReferenceCount} for ${summary.referenceCount}`,
    );
  }

  if (
    Number.isFinite(summary.referenceCount) &&
    references.length !== summary.referenceCount
  ) {
    contractErrors.push(
      `summary.referenceCount must match references.length; received ${summary.referenceCount} for ${references.length}`,
    );
  }

  for (const reference of references) {
    if (!allowedReferenceKinds.has(reference.referenceKind)) {
      contractErrors.push(
        `${reference.consumer} ${reference.dependencyName} has unsupported referenceKind ${reference.referenceKind}`,
      );
      continue;
    }

    if (
      reference.referenceKind === "matching-file" &&
      reference.fileSpecMatchesCurrentVersion !== true
    ) {
      contractErrors.push(
        `${reference.consumer} ${reference.dependencyName} matching-file reference must set fileSpecMatchesCurrentVersion=true`,
      );
    }

    if (
      reference.referenceKind === "stale-file" &&
      reference.fileSpecMatchesCurrentVersion !== false
    ) {
      contractErrors.push(
        `${reference.consumer} ${reference.dependencyName} stale-file reference must set fileSpecMatchesCurrentVersion=false`,
      );
    }

    if (
      reference.referenceKind === "external" &&
      reference.fileSpecMatchesCurrentVersion !== null
    ) {
      contractErrors.push(
        `${reference.consumer} ${reference.dependencyName} external reference must set fileSpecMatchesCurrentVersion=null`,
      );
    }
  }

  return contractErrors;
};

export const printIntegrationReport = (report) => {
  console.log("# DID Integration Report");
  console.log(`Schema: ${report.schemaId}@${report.schemaVersion}`);
  console.log(`Repository: ${report.repository}`);
  console.log(`Branch: ${report.git.branch ?? "unknown"}`);
  console.log(`Commit: ${report.git.commit ?? "unknown"}`);
  console.log("");
  console.log("## DID Packages");
  for (const didPackage of report.packages) {
    console.log(
      `- ${didPackage.name}@${didPackage.version} (${didPackage.path}) dist=${didPackage.distIndex ? "yes" : "no"} managed=${didPackage.managedIndex ? "yes" : "no"}`,
    );
  }
  console.log("");
  console.log("## VC References");
  if (!report.siblingVc.present) {
    console.log("- sibling VC checkout not found");
  } else if (report.siblingVc.references.length === 0) {
    console.log("- no exact DID package references found");
  } else {
    console.log(
      `- references=${report.siblingVc.summary.referenceCount} matching-file-specs=${report.siblingVc.summary.matchingFileSpecCount} stale-file-specs=${report.siblingVc.summary.staleFileSpecCount} external-specs=${report.siblingVc.summary.externalSpecCount} missing-vendor-tarballs=${report.siblingVc.summary.missingVendorTarballCount}`,
    );
    for (const note of INTEGRATION_REPORT_SCHEMA.summaryCounterPolicy.notes) {
      console.log(`- note: ${note}`);
    }
    for (const reference of report.siblingVc.references) {
      console.log(
        `- ${reference.consumer}: ${reference.dependencyName} -> ${reference.spec} kind=${reference.referenceKind} current-vendor=${reference.currentVendorTarballPresent ? "yes" : "no"} referenced-vendor=${reference.referencedVendorTarballPresent === null ? "n/a" : reference.referencedVendorTarballPresent ? "yes" : "no"}`,
      );
    }
  }

  if (report.warnings.length > 0) {
    console.log("");
    console.log("## Warnings");
    for (const warning of report.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (report.errors.length > 0) {
    console.log("");
    console.log("## Errors");
    for (const error of report.errors) {
      console.log(`- ${error}`);
    }
  }

  const contractErrors = report.contractErrors ?? [];
  if (contractErrors.length > 0) {
    console.log("");
    console.log("## Contract Errors");
    for (const contractError of contractErrors) {
      console.log(`- ${contractError}`);
    }
  }
};

const parseArgs = (argv) => {
  const args = new Set(argv);
  // Make usage reachable even when a caller also passes a stale or misspelled flag.
  if (args.has("--help") || args.has("-h")) {
    return {
      check: false,
      json: false,
      schema: false,
      help: true,
    };
  }

  const unknownArgs = argv.filter(
    (argument) => !["--check", "--json", "--schema", "--help", "-h"].includes(argument),
  );
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown report-integration argument: ${unknownArgs.join(", ")}`);
  }
  if (args.has("--schema") && (args.has("--check") || args.has("--json"))) {
    throw new Error("--schema cannot be combined with --check or --json");
  }
  return {
    check: args.has("--check"),
    json: args.has("--json"),
    schema: args.has("--schema"),
    help: false,
  };
};

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage);
      process.exit(0);
    }

    if (args.schema) {
      console.log(JSON.stringify(INTEGRATION_REPORT_SCHEMA, null, 2));
      process.exit(0);
    }

    const report = buildIntegrationReport();
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printIntegrationReport(report);
    }

    if (
      args.check &&
      (report.errors.length > 0 || (report.contractErrors ?? []).length > 0)
    ) {
      for (const contractError of report.contractErrors ?? []) {
        console.error(`[report-integration] Contract error: ${contractError}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error(`[report-integration] ${error.message}`);
    console.error("Run `node scripts/report-integration.mjs --help` for usage.");
    process.exit(1);
  }
}
