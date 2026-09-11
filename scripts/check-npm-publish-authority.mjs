#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  npmPackageRegistry,
  packageManifestCatalog,
  publishWorkspaces,
} from "./did-workspace-catalog.mjs";

export const expectedNpmIdentity = "ntwrk-bot";
export const npmAuthorityTimeoutMs = 15_000;
export const npmAuthorityOutputLimit = 64 * 1024;

export const npmAuthorityPackages = Object.freeze(
  publishWorkspaces.map((workspace) => {
    const packageName = packageManifestCatalog.get(workspace)?.name;
    if (typeof packageName !== "string") {
      throw new Error("The npm package catalog is incomplete.");
    }
    return packageName;
  }),
);

class AuthorityCheckError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorityCheckError";
  }
}

const invalidEvidence = () =>
  new AuthorityCheckError("npm returned invalid authority evidence.");

class StrictJsonReader {
  constructor(text) {
    this.text = text;
    this.index = 0;
  }

  read() {
    this.#skipWhitespace();
    const value = this.#readValue();
    this.#skipWhitespace();
    if (this.index !== this.text.length) throw invalidEvidence();
    return value;
  }

  #skipWhitespace() {
    while ([" ", "\t", "\r", "\n"].includes(this.text[this.index])) {
      this.index += 1;
    }
  }

  #readValue() {
    const character = this.text[this.index];
    if (character === '"') return this.#readString();
    if (character === "{") return this.#readObject();
    if (character === "[") return this.#readArray();
    if (character === "t") return this.#readLiteral("true", true);
    if (character === "f") return this.#readLiteral("false", false);
    if (character === "n") return this.#readLiteral("null", null);
    return this.#readNumber();
  }

  #readString() {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.text.length) {
      const character = this.text[this.index];
      if (!escaped && character === '"') {
        this.index += 1;
        try {
          return JSON.parse(this.text.slice(start, this.index));
        } catch {
          throw invalidEvidence();
        }
      }
      if (!escaped && character.codePointAt(0) < 0x20) throw invalidEvidence();
      if (!escaped && character === "\\") {
        escaped = true;
      } else {
        escaped = false;
      }
      this.index += 1;
    }
    throw invalidEvidence();
  }

  #readObject() {
    this.index += 1;
    this.#skipWhitespace();
    const value = Object.create(null);
    const keys = new Set();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return value;
    }
    while (this.index < this.text.length) {
      if (this.text[this.index] !== '"') throw invalidEvidence();
      const key = this.#readString();
      if (keys.has(key)) throw invalidEvidence();
      keys.add(key);
      this.#skipWhitespace();
      if (this.text[this.index] !== ":") throw invalidEvidence();
      this.index += 1;
      this.#skipWhitespace();
      value[key] = this.#readValue();
      this.#skipWhitespace();
      if (this.text[this.index] === "}") {
        this.index += 1;
        return value;
      }
      if (this.text[this.index] !== ",") throw invalidEvidence();
      this.index += 1;
      this.#skipWhitespace();
    }
    throw invalidEvidence();
  }

  #readArray() {
    this.index += 1;
    this.#skipWhitespace();
    const value = [];
    if (this.text[this.index] === "]") {
      this.index += 1;
      return value;
    }
    while (this.index < this.text.length) {
      value.push(this.#readValue());
      this.#skipWhitespace();
      if (this.text[this.index] === "]") {
        this.index += 1;
        return value;
      }
      if (this.text[this.index] !== ",") throw invalidEvidence();
      this.index += 1;
      this.#skipWhitespace();
    }
    throw invalidEvidence();
  }

  #readLiteral(literal, value) {
    if (!this.text.startsWith(literal, this.index)) throw invalidEvidence();
    this.index += literal.length;
    return value;
  }

  #readNumber() {
    const match = this.text
      .slice(this.index)
      .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
    if (match == null) throw invalidEvidence();
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) throw invalidEvidence();
    return value;
  }
}

function parseStrictJson(buffer) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw invalidEvidence();
  }
  return new StrictJsonReader(text).read();
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
    // The child may have exited between the state check and the signal.
  }
}

async function runNpmJson({
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

    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      terminate(child);
      reject(new AuthorityCheckError(message));
    };
    const collect = (chunk, retain) => {
      outputBytes += chunk.length;
      if (outputBytes > outputLimit) {
        fail("npm authority evidence exceeded the output limit.");
        return;
      }
      if (retain) stdout.push(chunk);
    };

    child.stdout.on("data", (chunk) => collect(chunk, true));
    child.stderr.on("data", (chunk) => collect(chunk, false));
    child.on("error", () => fail("The npm authority command failed."));
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0 || signal != null) {
        reject(new AuthorityCheckError("The npm authority command failed."));
        return;
      }
      try {
        resolve(parseStrictJson(Buffer.concat(stdout)));
      } catch {
        reject(invalidEvidence());
      }
    });

    const timer = setTimeout(
      () => fail("The npm authority command timed out."),
      timeoutMs,
    );
    timer.unref();
  });
}

function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function verifyNpmPublishAuthority({
  token,
  npmExecutable = "npm",
  ambientEnv = process.env,
  timeoutMs = npmAuthorityTimeoutMs,
  outputLimit = npmAuthorityOutputLimit,
  temporaryRoot = tmpdir(),
} = {}) {
  if (typeof token !== "string" || token.length === 0) {
    throw new AuthorityCheckError("The npm release credential is unavailable.");
  }
  if (npmPackageRegistry !== "https://registry.npmjs.org/") {
    throw new AuthorityCheckError("The npm registry configuration is invalid.");
  }

  const root = await mkdtemp(
    path.join(temporaryRoot, "npm-release-authority-"),
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
      writeFile(
        userConfig,
        `registry=${npmPackageRegistry}\n//registry.npmjs.org/:_authToken=\${NODE_AUTH_TOKEN}\nalways-auth=true\n`,
        { mode: 0o600 },
      ),
      writeFile(globalConfig, "", { mode: 0o600 }),
    ]);
    await Promise.all([
      chmod(cache, 0o700),
      chmod(processTmp, 0o700),
      chmod(userConfig, 0o600),
      chmod(globalConfig, 0o600),
    ]);

    const childEnv = {
      HOME: root,
      NODE_AUTH_TOKEN: token,
      NPM_CONFIG_CACHE: cache,
      NPM_CONFIG_GLOBALCONFIG: globalConfig,
      NPM_CONFIG_REGISTRY: npmPackageRegistry,
      NPM_CONFIG_USERCONFIG: userConfig,
      PATH: ambientEnv.PATH ?? "",
      TMPDIR: processTmp,
    };
    const common = {
      npmExecutable,
      env: childEnv,
      cwd: root,
      timeoutMs,
      outputLimit,
    };

    const identity = await runNpmJson({
      ...common,
      args: [
        "whoami",
        "--json",
        "--registry",
        npmPackageRegistry,
        "--loglevel=silent",
      ],
    });
    if (identity !== expectedNpmIdentity) {
      throw new AuthorityCheckError(
        "The authenticated npm identity is not authorized for release.",
      );
    }

    const packageAccess = await runNpmJson({
      ...common,
      args: [
        "access",
        "list",
        "packages",
        expectedNpmIdentity,
        "--json",
        "--registry",
        npmPackageRegistry,
        "--loglevel=silent",
      ],
    });
    if (
      !isJsonObject(packageAccess) ||
      Object.values(packageAccess).some((access) => typeof access !== "string")
    ) {
      throw invalidEvidence();
    }
    if (
      npmAuthorityPackages.some(
        (packageName) => packageAccess[packageName] !== "read-write",
      )
    ) {
      throw new AuthorityCheckError(
        "The npm release identity lacks required package authority.",
      );
    }

    return {
      identity: expectedNpmIdentity,
      packages: [...npmAuthorityPackages],
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
    const result = await verifyNpmPublishAuthority({
      token: process.env.NODE_AUTH_TOKEN,
    });
    console.log(
      `[npm-release-authority] Verified ${result.identity} read-write authority for ${result.packages.length} packages at ${result.registry}`,
    );
  } catch (error) {
    const message =
      error instanceof AuthorityCheckError
        ? error.message
        : "The npm authority check failed.";
    console.error(`[npm-release-authority] ${message}`);
    process.exitCode = 1;
  }
}
