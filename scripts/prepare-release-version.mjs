#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { artifactWorkspaces } from "./did-workspace-catalog.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const parseArgs = () => {
  const options = {
    dryRun: false,
    json: false,
  };
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--":
        break;
      case "--channel":
        options.channel = args[++index];
        break;
      case "--version":
        options.version = args[++index];
        break;
      case "--rc-index":
        options.rcIndex = args[++index];
        break;
      case "--github-output":
        options.githubOutput = args[++index];
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
        console.log(
          [
            "Usage: prepare-release-version.mjs --channel <snapshot|rc|release> [options]",
            "",
            "Options:",
            "  --version <x.y.z>       Base release version. Defaults to package.json version.",
            "  --rc-index <n>         Required for rc channel; creates x.y.z-rc{n}.",
            "  --github-output <path> Append version outputs for GitHub Actions.",
            "  --dry-run              Compute but do not rewrite package.json files.",
            "  --json                 Print the computed metadata as JSON.",
          ].join("\n"),
        );
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
};

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

const writeJson = (relativePath, value) => {
  fs.writeFileSync(
    path.join(repoRoot, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
  );
};

const writeApiReleaseArtifactVersion = (version) => {
  const relativePath = "packages/api/src/release-artifacts.ts";
  const targetPath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(targetPath, "utf8");
  const pattern =
    /export const MIDNIGHT_DID_API_VERSION = "[^"]+" as const;/u;
  if (!pattern.test(source)) {
    throw new Error(`${relativePath} does not contain release version marker`);
  }
  fs.writeFileSync(
    targetPath,
    source.replace(
      pattern,
      `export const MIDNIGHT_DID_API_VERSION = ${JSON.stringify(version)} as const;`,
    ),
  );
};

const requireStableVersion = (value, label) => {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value ?? "")) {
    throw new Error(`${label} must be a stable semver version like 1.2.3`);
  }
  return value;
};

const git = (...args) => {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
};

const normalizeShortSha = () => {
  const sha =
    process.env.GITHUB_SHA ??
    git("rev-parse", "--short=12", "HEAD") ??
    "local";
  return sha.slice(0, 12).replace(/[^0-9a-z]/giu, "").toLowerCase() || "local";
};

const localRunId = () =>
  new Date()
    .toISOString()
    .replace(/[-:TZ.]/gu, "")
    .slice(0, 14);

const computeVersion = ({ channel, baseVersion, rcIndex }) => {
  const shortSha = normalizeShortSha();

  switch (channel) {
    case "snapshot": {
      const runNumber = process.env.GITHUB_RUN_NUMBER ?? localRunId();
      return {
        version: `${baseVersion}-snapshot.${runNumber}.${shortSha}`,
        npmTag: "snapshot",
        releaseTag: "",
        prerelease: "true",
        shortSha,
      };
    }
    case "rc": {
      if (!/^[1-9]\d*$/u.test(rcIndex ?? "")) {
        throw new Error("--rc-index must be a positive integer for rc releases");
      }
      const version = `${baseVersion}-rc${rcIndex}`;
      return {
        version,
        npmTag: "rc",
        releaseTag: `v${version}`,
        prerelease: "true",
        shortSha,
      };
    }
    case "release":
      return {
        version: baseVersion,
        npmTag: "latest",
        releaseTag: `v${baseVersion}`,
        prerelease: "false",
        shortSha,
      };
    default:
      throw new Error(
        `--channel must be one of snapshot, rc, or release; got ${channel}`,
      );
  }
};

const writeGitHubOutput = (outputPath, entries) => {
  if (!outputPath) {
    return;
  }

  const lines = Object.entries(entries).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
};

const options = parseArgs();
const rootPackage = readJson("package.json");
const channel = options.channel ?? process.env.RELEASE_CHANNEL;
const baseVersion = requireStableVersion(
  options.version ?? rootPackage.version,
  "--version",
);
const computed = computeVersion({
  channel,
  baseVersion,
  rcIndex: options.rcIndex,
});

const metadata = {
  channel,
  baseVersion,
  version: computed.version,
  npmTag: computed.npmTag,
  releaseTag: computed.releaseTag,
  prerelease: computed.prerelease,
  shortSha: computed.shortSha,
  dryRun: options.dryRun,
};

if (!options.dryRun) {
  rootPackage.version = computed.version;
  writeJson("package.json", rootPackage);

  for (const workspace of artifactWorkspaces) {
    const packagePath = path.join(workspace, "package.json");
    const packageJson = readJson(packagePath);
    packageJson.version = computed.version;
    writeJson(packagePath, packageJson);
  }

  writeApiReleaseArtifactVersion(computed.version);
}

writeGitHubOutput(options.githubOutput, {
  channel,
  base_version: baseVersion,
  version: computed.version,
  npm_tag: computed.npmTag,
  release_tag: computed.releaseTag,
  prerelease: computed.prerelease,
  short_sha: computed.shortSha,
});

if (options.json) {
  console.log(JSON.stringify(metadata, null, 2));
} else {
  console.log(
    `[prepare-release-version] ${channel} version ${computed.version} (npm tag ${computed.npmTag})`,
  );
}
