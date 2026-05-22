#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const usage = `Usage: node scripts/report-integration.mjs [--check] [--json] [-h|--help]

Print DID package readiness and sibling midnight-verifiable-credentials
references.

Summary counters partition references by matching/stale/external specs; missing
vendor tarballs are an independent error dimension.

Environment overrides for tests and workspace automation:
  MIDNIGHT_DID_REPO_ROOT          DID repository root to inspect.
  MIDNIGHT_DID_SIBLING_VC_ROOT    VC repository root to inspect.
  MIDNIGHT_DID_INTEGRATION_NOW    Stable ISO-8601 generatedAt timestamp.
`;

const defaultRepoRoot = () =>
  execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();

const readJson = (absolutePath) =>
  JSON.parse(readFileSync(absolutePath, "utf8"));

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
  const skip = new Set([
    ".git",
    "node_modules",
    "dist",
    "coverage",
    "reports",
    "target",
    "vendor",
  ]);

  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) {
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
        const referencedFileName = spec.startsWith("file:")
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
          consumer: packageJson.name ?? vcRelativePackageJson,
          packageJson: vcRelativePackageJson,
          fileSpecMatchesCurrentVersion: spec === expectedFileSpec,
          currentVendorTarballPresent,
          referencedVendorTarballPresent: referencedTarball
            ? siblingVc.vendorTarballs.includes(referencedTarball)
            : null,
        };

        siblingVc.references.push(reference);

        if (spec === expectedFileSpec) {
          siblingVc.summary.matchingFileSpecCount += 1;
        } else if (!spec.startsWith("file:")) {
          siblingVc.summary.externalSpecCount += 1;
        } else {
          siblingVc.summary.staleFileSpecCount += 1;
        }

        if (spec.startsWith("file:") && !reference.fileSpecMatchesCurrentVersion) {
          errors.push(
            `${reference.consumer} references ${dependencyName} as ${spec}; expected ${expectedFileSpec}`,
          );
        }

        if (spec.startsWith("file:") && !reference.currentVendorTarballPresent) {
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
  const didVendorRoot = path.join(siblingVcRoot, "tooling/vendor/midnight-did");
  const packages = collectDidPackages(repoRoot, warnings);
  const siblingVc = collectSiblingVcReferences({
    didPackages: packages,
    siblingVcRoot,
    didVendorRoot,
    errors,
    warnings,
  });

  return {
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
};

export const printIntegrationReport = (report) => {
  console.log("# DID Integration Report");
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
    for (const reference of report.siblingVc.references) {
      console.log(
        `- ${reference.consumer}: ${reference.dependencyName} -> ${reference.spec} current-vendor=${reference.currentVendorTarballPresent ? "yes" : "no"} referenced-vendor=${reference.referencedVendorTarballPresent === null ? "n/a" : reference.referencedVendorTarballPresent ? "yes" : "no"}`,
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
};

const parseArgs = (argv) => {
  const args = new Set(argv);
  if (args.has("--help") || args.has("-h")) {
    return {
      check: false,
      json: false,
      help: true,
    };
  }

  const unknownArgs = argv.filter(
    (argument) => !["--check", "--json", "--help", "-h"].includes(argument),
  );
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown report-integration argument: ${unknownArgs.join(", ")}`);
  }
  return {
    check: args.has("--check"),
    json: args.has("--json"),
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

    const report = buildIntegrationReport();
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printIntegrationReport(report);
    }

    if (args.check && report.errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`[report-integration] ${error.message}`);
    console.error("Run `node scripts/report-integration.mjs --help` for usage.");
    process.exit(1);
  }
}
