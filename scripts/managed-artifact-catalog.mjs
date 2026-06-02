#!/usr/bin/env node
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(thisFile), "..");

// This is a developer/CI freshness guard. The mtime check is the local rebuild
// gate, and sourceManifest gives external consumers a deterministic source
// content stamp for the inputs behind each managed artifact profile.
const contractInputs = [
  "packages/contract/src/did.compact",
  "packages/contract/package.json",
  "packages/contract/scripts",
];
const jubjubSchnorrInputs = [
  "packages/jubjub-schnorr/src/jubjub-schnorr.compact",
  "packages/jubjub-schnorr/src/schnorr.compact",
  "packages/jubjub-schnorr/package.json",
  "packages/jubjub-schnorr/scripts",
];

const output = (relativePath, inputs) => ({
  path: relativePath,
  inputs,
});

export const artifactProfiles = {
  contract: {
    buildCommand: "pnpm --filter ./packages/contract build:prepared",
    outputs: [
      output("packages/contract/src/managed/did/contract/index.js", contractInputs),
      output(
        "packages/contract/src/managed/did/compiler/contract-info.json",
        contractInputs,
      ),
    ],
  },
  "jubjub-schnorr": {
    buildCommand: "pnpm --filter ./packages/jubjub-schnorr build",
    outputs: [
      output(
        "packages/jubjub-schnorr/src/managed/jubjub-schnorr/contract/index.js",
        jubjubSchnorrInputs,
      ),
      output(
        "packages/jubjub-schnorr/src/managed/jubjub-schnorr/compiler/contract-info.json",
        jubjubSchnorrInputs,
      ),
    ],
  },
};

export const profileNames = Object.keys(artifactProfiles);

const readJson = (relativePath) =>
  JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));

const newestInputMtimeMs = (inputs) => {
  let newest = 0;

  const visit = (absolutePath) => {
    if (!existsSync(absolutePath)) {
      return;
    }

    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(absolutePath)) {
        visit(path.join(absolutePath, entry));
      }
      return;
    }

    newest = Math.max(newest, stat.mtimeMs);
  };

  for (const input of inputs) {
    visit(path.join(repoRoot, input));
  }

  return newest;
};

const missingInputsFor = (inputs) =>
  inputs.filter((input) => !existsSync(path.join(repoRoot, input)));

const portablePath = (relativePath) => relativePath.split(path.sep).join("/");

const collectInputFiles = (inputs, root = repoRoot) => {
  const files = [];

  const visit = (relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (!existsSync(absolutePath)) {
      return;
    }

    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(absolutePath).sort()) {
        visit(path.join(relativePath, entry));
      }
      return;
    }

    files.push(portablePath(relativePath));
  };

  for (const input of inputs) {
    visit(input);
  }

  return [...new Set(files)].sort();
};

export const createInputSourceManifest = (inputs, root = repoRoot) => {
  const files = collectInputFiles(inputs, root);
  const digest = createHash("sha256");
  const missingInputs = inputs.filter((input) => !existsSync(path.join(root, input)));

  for (const file of files) {
    digest.update(file);
    digest.update("\0");
    digest.update(readFileSync(path.join(root, file)));
    digest.update("\0");
  }

  return {
    algorithm: "sha256",
    digest: digest.digest("hex"),
    files,
    missingInputs,
  };
};

const uniqueInputsForProfile = (profile) =>
  [...new Set(profile.outputs.flatMap((artifact) => artifact.inputs))].sort();

export const explainProfile = (profileName) => {
  const profile = artifactProfiles[profileName];
  if (!profile) {
    return {
      known: false,
      ready: false,
      missing: [],
      stale: [],
      missingInputs: [],
      outputs: [],
      sourceManifest: null,
    };
  }

  const missing = [];
  const missingInputs = [];
  const stale = [];
  const profileInputs = uniqueInputsForProfile(profile);

  for (const artifact of profile.outputs) {
    const absolutePath = path.join(repoRoot, artifact.path);
    const missingArtifactInputs = missingInputsFor(artifact.inputs);
    if (missingArtifactInputs.length > 0) {
      missingInputs.push(
        ...missingArtifactInputs.map(
          (input) => `${artifact.path} depends on missing input ${input}`,
        ),
      );
      continue;
    }

    if (!existsSync(absolutePath)) {
      missing.push(artifact.path);
      continue;
    }

    const newestInput = newestInputMtimeMs(artifact.inputs);
    if (newestInput > 0 && statSync(absolutePath).mtimeMs + 1 < newestInput) {
      stale.push(artifact.path);
    }
  }

  return {
    known: true,
    ready:
      missing.length === 0 &&
      missingInputs.length === 0 &&
      stale.length === 0,
    buildCommand: profile.buildCommand,
    missing,
    missingInputs,
    stale,
    inputs: profileInputs,
    outputs: profile.outputs.map((artifact) => artifact.path),
    sourceManifest: createInputSourceManifest(profileInputs),
  };
};

const checkCatalog = () => {
  const errors = [];
  const rootPackage = readJson("package.json");
  const scripts = rootPackage.scripts ?? {};

  for (const [profileName, profile] of Object.entries(artifactProfiles)) {
    if (!profile.buildCommand) {
      errors.push(`${profileName} is missing buildCommand`);
    }

    const workspaceScriptMatch = profile.buildCommand.match(
      /^pnpm --filter \.\/(.+) ([^\s]+)$/u,
    );
    const rootScriptName = profile.buildCommand.match(/^pnpm run ([^\s]+)$/u)?.[1];

    if (workspaceScriptMatch) {
      const [, workspacePath, scriptName] = workspaceScriptMatch;
      const packageJsonPath = path.join(workspacePath, "package.json");
      if (!existsSync(path.join(repoRoot, packageJsonPath))) {
        errors.push(`${profileName} references missing workspace: ${workspacePath}`);
      } else {
        const packageScripts = readJson(packageJsonPath).scripts ?? {};
        if (!packageScripts[scriptName]) {
          errors.push(
            `${profileName} references missing workspace script: ${workspacePath}#${scriptName}`,
          );
        }
      }
    } else if (rootScriptName && !scripts[rootScriptName]) {
      errors.push(`${profileName} references missing root script: ${rootScriptName}`);
    }

    for (const artifact of profile.outputs) {
      if (path.isAbsolute(artifact.path) || artifact.path.includes("..")) {
        errors.push(`${profileName} has unsafe output path: ${artifact.path}`);
      }

      for (const input of artifact.inputs) {
        if (path.isAbsolute(input) || input.includes("..")) {
          errors.push(`${profileName} has unsafe input path: ${input}`);
        }
      }
    }
  }

  return errors;
};

const explainAllProfiles = () =>
  Object.fromEntries(
    profileNames.map((profileName) => [
      profileName,
      explainProfile(profileName),
    ]),
  );

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === thisFile;
const [command, value, ...extraArgs] = process.argv.slice(2);

if (isDirectExecution) {
  try {
    if (extraArgs.length > 0) {
      stderr.write(
        `[managed-artifact-catalog] Unexpected arguments: ${extraArgs.join(" ")}\n`,
      );
      process.exit(2);
    }

    switch (command) {
      case "--profile-names":
        stdout.write(`${profileNames.join("\n")}\n`);
        break;
      case "--build-command": {
        const profile = artifactProfiles[value];
        if (!profile) {
          stderr.write(`[managed-artifact-catalog] Unknown artifact profile: ${value}\n`);
          process.exit(2);
        }
        stdout.write(`${profile.buildCommand}\n`);
        break;
      }
      case "--ready": {
        const report = explainProfile(value);
        if (!report.known) {
          stderr.write(`[managed-artifact-catalog] Unknown artifact profile: ${value}\n`);
          process.exit(2);
        }
        process.exit(report.ready ? 0 : 1);
      }
      case "--explain":
        stdout.write(`${JSON.stringify(explainProfile(value), null, 2)}\n`);
        break;
      case "--check-catalog": {
        const errors = checkCatalog();
        if (errors.length > 0) {
          for (const error of errors) {
            stderr.write(`[managed-artifact-catalog] ${error}\n`);
          }
          process.exit(1);
        }
        stdout.write(
          `[managed-artifact-catalog] Verified ${profileNames.length} artifact profiles.\n`,
        );
        break;
      }
      case "--check": {
        const errors = checkCatalog();
        const reports = explainAllProfiles();
        for (const [profileName, report] of Object.entries(reports)) {
          for (const missing of report.missing) {
            errors.push(`${profileName} missing generated artifact: ${missing}`);
          }
          for (const missingInput of report.missingInputs) {
            errors.push(`${profileName} ${missingInput}`);
          }
          for (const stale of report.stale) {
            errors.push(`${profileName} stale generated artifact: ${stale}`);
          }
        }

        if (errors.length > 0) {
          for (const error of errors) {
            stderr.write(`[managed-artifact-catalog] ${error}\n`);
          }
          process.exit(1);
        }
        stdout.write(
          `[managed-artifact-catalog] Verified ${profileNames.length} fresh artifact profiles.\n`,
        );
        break;
      }
      case "--json":
      case undefined:
        stdout.write(`${JSON.stringify(explainAllProfiles(), null, 2)}\n`);
        break;
      default:
        stderr.write(
          "Usage: managed-artifact-catalog.mjs --profile-names | --build-command <profile> | --ready <profile> | --explain <profile> | --check-catalog | --check | --json\n",
        );
        process.exit(1);
    }
  } catch (error) {
    stderr.write(`[managed-artifact-catalog] ${error.message}\n`);
    process.exit(1);
  }
}
