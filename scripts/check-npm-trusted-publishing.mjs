#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { spawn } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  npmPackageRegistry,
  packageManifestCatalog,
  publishWorkspaces,
  repositoryUrl,
} from "./did-workspace-catalog.mjs";

export const trustedPublishingMinimumNpmVersion = "11.5.1";
export const trustedPublishingEnvironment = "npm-release";
export const trustedPublishingRepository = "midnightntwrk/midnight-did";
export const trustedPublishingWorkflow = ".github/workflows/publish.yml";
export const trustedPublishingTimeoutMs = 15_000;
export const trustedPublishingOutputLimit = 64 * 1024;
export const trustedPublishingPackages = Object.freeze(
  publishWorkspaces.map((workspace) => {
    const packageName = packageManifestCatalog.get(workspace)?.name;
    if (typeof packageName !== "string") {
      throw new Error("The npm package catalog is incomplete.");
    }
    return packageName;
  }),
);

class TrustedPublishingCheckError extends Error {
  constructor(message) {
    super(message);
    this.name = "TrustedPublishingCheckError";
  }
}

function fail(message) {
  throw new TrustedPublishingCheckError(message);
}

function hasOwn(environment, name) {
  return Object.prototype.hasOwnProperty.call(environment, name);
}

function validateContext(environment) {
  if (environment.GITHUB_REPOSITORY !== trustedPublishingRepository) {
    fail(
      "The GitHub repository does not match the trusted-publisher configuration.",
    );
  }
  if (environment.GITHUB_ACTIONS !== "true") {
    fail("Trusted publication must run in GitHub Actions.");
  }
  if (environment.RUNNER_ENVIRONMENT !== "github-hosted") {
    fail("Trusted publication requires a GitHub-hosted runner.");
  }
  if (environment.GITHUB_REF_TYPE !== "branch") {
    fail("Trusted publication requires a branch ref.");
  }
  if (
    !["refs/heads/main", "refs/heads/develop"].includes(environment.GITHUB_REF)
  ) {
    fail("The publication ref is not an allowed exact branch ref.");
  }
  const expectedWorkflowRef = `${trustedPublishingRepository}/${trustedPublishingWorkflow}@${environment.GITHUB_REF}`;
  if (environment.GITHUB_WORKFLOW_REF !== expectedWorkflowRef) {
    fail(
      "The workflow identity does not match publish.yml at the exact publication ref.",
    );
  }
  if (
    environment.NPM_TRUSTED_PUBLISHING_ENVIRONMENT !==
    trustedPublishingEnvironment
  ) {
    fail("The trusted-publishing environment expectation is not npm-release.");
  }
  for (const name of [
    "ACTIONS_ID_TOKEN_REQUEST_URL",
    "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  ]) {
    if (
      typeof environment[name] !== "string" ||
      environment[name].length === 0
    ) {
      fail("GitHub OIDC request capability is unavailable.");
    }
  }
}

function rejectAmbientAuthentication(environment) {
  for (const name of ["NODE_AUTH_TOKEN", "NPM_TOKEN", "NPM_ID_TOKEN"]) {
    if (hasOwn(environment, name)) {
      fail("Ambient npm authentication is forbidden for Trusted Publishing.");
    }
  }
  if (hasOwn(environment, "NODE_OPTIONS")) {
    fail(
      "Ambient Node.js runtime options are forbidden for Trusted Publishing.",
    );
  }
  for (const [name] of Object.entries(environment)) {
    if (
      /^npm_config_/iu.test(name) &&
      /(?:^|_)(?:auth|auth_token|authtoken|password|token|username|otp|cert|certfile|key|keyfile)(?:$|_)/iu.test(
        name,
      )
    ) {
      fail(
        "Ambient npm authentication configuration is forbidden for Trusted Publishing.",
      );
    }
  }
  for (const name of ["NPM_REGISTRY", "NPM_CONFIG_REGISTRY"]) {
    if (hasOwn(environment, name) && environment[name] !== npmPackageRegistry) {
      fail("Trusted Publishing requires the exact canonical npmjs registry.");
    }
  }
}

async function exists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function rejectCredentialNpmrc(environment, cwd) {
  const candidates = new Set([path.join(cwd, ".npmrc")]);
  if (typeof environment.HOME === "string" && environment.HOME.length > 0) {
    candidates.add(path.join(environment.HOME, ".npmrc"));
  }
  for (const name of ["NPM_CONFIG_USERCONFIG", "NPM_CONFIG_GLOBALCONFIG"]) {
    if (typeof environment[name] === "string" && environment[name].length > 0) {
      candidates.add(path.resolve(cwd, environment[name]));
    }
  }

  for (const candidate of candidates) {
    if (!(await exists(candidate))) continue;
    let contents;
    try {
      contents = await readFile(candidate, "utf8");
    } catch {
      fail("An npm configuration file could not be safely inspected.");
    }
    if (Buffer.byteLength(contents) > trustedPublishingOutputLimit) {
      fail("An npm configuration file exceeded the inspection limit.");
    }
    for (const sourceLine of contents.split(/\r?\n/u)) {
      const line = sourceLine.trim();
      if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
      if (!/(?:_authToken|_auth|username|password)\s*=/iu.test(line)) continue;
      if (
        line.startsWith("//") &&
        !/^\/\/registry\.npmjs\.org\//iu.test(line)
      ) {
        continue;
      }
      if (
        /^\/\/registry\.npmjs\.org\/:_authToken=\$\{NODE_AUTH_TOKEN\}$/iu.test(
          line,
        )
      ) {
        continue;
      }
      fail(
        "npmjs credential configuration is forbidden for Trusted Publishing.",
      );
    }
  }
}

function validateCatalog() {
  const expectedPackages = [
    "@midnight-ntwrk/midnight-did-jubjub-schnorr",
    "@midnight-ntwrk/midnight-did-contract",
    "@midnight-ntwrk/midnight-did-domain",
    "@midnight-ntwrk/midnight-did",
    "@midnight-ntwrk/midnight-did-api",
  ];
  if (
    npmPackageRegistry !== "https://registry.npmjs.org/" ||
    repositoryUrl !== "git+https://github.com/midnightntwrk/midnight-did.git" ||
    JSON.stringify(trustedPublishingPackages) !==
      JSON.stringify(expectedPackages)
  ) {
    fail("The canonical npm publication catalog is invalid.");
  }
}

function terminate(child) {
  if (child.exitCode != null || child.signalCode != null) return;
  try {
    if (process.platform !== "win32" && child.pid != null) {
      process.kill(-child.pid, "SIGKILL");
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    // The process may have exited between inspection and termination.
  }
}

async function runNpm({
  npmExecutable,
  args,
  env,
  cwd,
  timeoutMs,
  outputLimit,
}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let outputBytes = 0;
    const stdout = [];
    const child = spawn(npmExecutable, args, {
      cwd,
      detached: process.platform !== "win32",
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stop = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      terminate(child);
      reject(new TrustedPublishingCheckError(message));
    };
    const collect = (chunk, retain) => {
      outputBytes += chunk.length;
      if (outputBytes > outputLimit) {
        stop("npm prerequisite output exceeded the limit.");
      } else if (retain) {
        stdout.push(chunk);
      }
    };
    child.stdout.on("data", (chunk) => collect(chunk, true));
    child.stderr.on("data", (chunk) => collect(chunk, false));
    child.on("error", () => stop("The npm prerequisite command failed."));
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0 || signal != null) {
        reject(
          new TrustedPublishingCheckError(
            "The npm prerequisite command failed.",
          ),
        );
      } else {
        resolve(Buffer.concat(stdout));
      }
    });
    const timer = setTimeout(
      () => stop("The npm prerequisite command timed out."),
      timeoutMs,
    );
    timer.unref();
  });
}

function decodeUtf8(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).trim();
  } catch {
    fail("npm returned malformed prerequisite evidence.");
  }
}

function parseNpmVersion(buffer) {
  const version = decodeUtf8(buffer);
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(version);
  if (match == null) fail("npm returned a malformed version.");
  const parts = match.slice(1, 4).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) {
    fail("npm returned a malformed version.");
  }
  return { raw: version, parts };
}

function versionAtLeast(actual, minimum) {
  const expected = minimum.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (actual[index] !== expected[index])
      return actual[index] > expected[index];
  }
  return true;
}

function parsePackageName(buffer, expectedName) {
  const text = decodeUtf8(buffer);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail("npm returned malformed public package metadata.");
  }
  if (value !== expectedName) {
    fail("npm returned unexpected public package metadata.");
  }
}

function childEnvironment(
  environment,
  root,
  cache,
  processTmp,
  userConfig,
  globalConfig,
) {
  const child = {
    HOME: root,
    NPM_CONFIG_CACHE: cache,
    NPM_CONFIG_GLOBALCONFIG: globalConfig,
    NPM_CONFIG_REGISTRY: npmPackageRegistry,
    NPM_CONFIG_USERCONFIG: userConfig,
    PATH: environment.PATH ?? "",
    TMPDIR: processTmp,
  };
  for (const name of [
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY",
    "NODE_EXTRA_CA_CERTS",
    "SSL_CERT_FILE",
  ]) {
    if (typeof environment[name] === "string") child[name] = environment[name];
  }
  return child;
}

export async function verifyNpmTrustedPublishingPrerequisites({
  npmExecutable = "npm",
  ambientEnv = process.env,
  cwd = path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  timeoutMs = trustedPublishingTimeoutMs,
  outputLimit = trustedPublishingOutputLimit,
  temporaryRoot = tmpdir(),
} = {}) {
  validateContext(ambientEnv);
  rejectAmbientAuthentication(ambientEnv);
  await rejectCredentialNpmrc(ambientEnv, cwd);
  validateCatalog();

  const root = await mkdtemp(
    path.join(temporaryRoot, "npm-trusted-publishing-"),
  );
  try {
    await chmod(root, 0o700);
    const cache = path.join(root, "cache");
    const processTmp = path.join(root, "tmp");
    const userConfig = path.join(root, "user.npmrc");
    const globalConfig = path.join(root, "global.npmrc");
    await Promise.all([
      mkdir(cache, { mode: 0o700 }),
      mkdir(processTmp, { mode: 0o700 }),
      writeFile(userConfig, `registry=${npmPackageRegistry}\n`, {
        mode: 0o600,
      }),
      writeFile(globalConfig, "", { mode: 0o600 }),
    ]);
    const env = childEnvironment(
      ambientEnv,
      root,
      cache,
      processTmp,
      userConfig,
      globalConfig,
    );
    const common = { npmExecutable, env, cwd, timeoutMs, outputLimit };
    const npmVersion = parseNpmVersion(
      await runNpm({ ...common, args: ["--version"] }),
    );
    if (!versionAtLeast(npmVersion.parts, trustedPublishingMinimumNpmVersion)) {
      fail(
        `npm ${trustedPublishingMinimumNpmVersion} or newer is required for Trusted Publishing.`,
      );
    }

    for (const packageName of trustedPublishingPackages) {
      parsePackageName(
        await runNpm({
          ...common,
          args: [
            "view",
            packageName,
            "name",
            "--json",
            "--registry",
            npmPackageRegistry,
            "--loglevel=silent",
          ],
        }),
        packageName,
      );
    }

    return {
      npmVersion: npmVersion.raw,
      packages: [...trustedPublishingPackages],
      registry: npmPackageRegistry,
    };
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

const isDirectExecution =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    const result = await verifyNpmTrustedPublishingPrerequisites();
    console.log(
      `[npm-trusted-publishing] Checked repository prerequisites with npm ${result.npmVersion} and public readability for ${result.packages.length} packages at ${result.registry}. npm-side trusted-publisher mapping was not verified and cannot be verified without an actual publish.`,
    );
  } catch (error) {
    const message =
      error instanceof TrustedPublishingCheckError
        ? error.message
        : "The npm Trusted Publishing prerequisite check failed.";
    console.error(`[npm-trusted-publishing] ${message}`);
    process.exitCode = 1;
  }
}
