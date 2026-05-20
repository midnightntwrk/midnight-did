#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const json = args.has("--json");
const siblingVcRoot = path.resolve(repoRoot, "..", "midnight-verifiable-credentials");
const didVendorRoot = path.join(siblingVcRoot, "tooling/vendor/midnight-did");
const errors = [];
const warnings = [];

const readJson = (absolutePath) => JSON.parse(readFileSync(absolutePath, "utf8"));
const npmPackFileName = (packageName, version) =>
  `${packageName.replace(/^@/u, "").replaceAll("/", "-")}-${version}.tgz`;

const gitValue = (args) => {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
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

const rootPackage = readJson(path.join(repoRoot, "package.json"));
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

const siblingVc = {
  path: siblingVcRoot,
  present: existsSync(path.join(siblingVcRoot, "package.json")),
  references: [],
  vendorTarballs: [],
};

if (siblingVc.present) {
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
        if (!didPackages.has(dependencyName)) {
          continue;
        }

        const didPackage = didPackages.get(dependencyName);
        const expectedTarball = didPackage.tarball;
        const expectedFileSpec = `file:../../../tooling/vendor/midnight-packages/did/${expectedTarball}`;
        const vcRelativePackageJson = path.relative(siblingVcRoot, packageJsonPath);
        const reference = {
          dependencyName,
          spec,
          expectedFileSpec,
          expectedTarball,
          consumer: packageJson.name ?? vcRelativePackageJson,
          packageJson: vcRelativePackageJson,
          fileSpecMatchesCurrentVersion: spec === expectedFileSpec,
          vendorTarballPresent: siblingVc.vendorTarballs.includes(expectedTarball),
        };

        siblingVc.references.push(reference);

        if (spec.startsWith("file:") && !reference.fileSpecMatchesCurrentVersion) {
          errors.push(
            `${reference.consumer} references ${dependencyName} as ${spec}; expected ${expectedFileSpec}`,
          );
        }

        if (spec.startsWith("file:") && !reference.vendorTarballPresent) {
          errors.push(
            `${reference.consumer} references ${dependencyName}, but vendor tarball is missing: ${expectedTarball}`,
          );
        }
      }
    }
  }
} else {
  warnings.push("Sibling midnight-verifiable-credentials checkout was not found; VC reference checks skipped.");
}

const report = {
  repository: "midnight-did",
  generatedAt: new Date().toISOString(),
  git: {
    branch: gitValue(["branch", "--show-current"]),
    commit: gitValue(["rev-parse", "--short", "HEAD"]),
  },
  packages: [...didPackages.values()].sort((a, b) => a.name.localeCompare(b.name)),
  siblingVc,
  errors,
  warnings,
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`# DID Integration Report`);
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
  if (!siblingVc.present) {
    console.log("- sibling VC checkout not found");
  } else if (siblingVc.references.length === 0) {
    console.log("- no exact DID package references found");
  } else {
    for (const reference of siblingVc.references) {
      console.log(
        `- ${reference.consumer}: ${reference.dependencyName} -> ${reference.spec} vendor=${reference.vendorTarballPresent ? "yes" : "no"}`,
      );
    }
  }

  if (warnings.length > 0) {
    console.log("");
    console.log("## Warnings");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.log("");
    console.log("## Errors");
    for (const error of errors) {
      console.log(`- ${error}`);
    }
  }
}

if (check && errors.length > 0) {
  process.exit(1);
}
