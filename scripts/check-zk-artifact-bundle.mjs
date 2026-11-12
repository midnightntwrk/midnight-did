#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseCompactCompilerVersion } from "./conformance/external-conformance-lib.mjs";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const archivePath = args[0] === "--archive" ? args[1] : args[0];

if (!archivePath || args.includes("--help")) {
  console.log("Usage: check-zk-artifact-bundle.mjs [--archive] <tar.gz>");
  process.exit(archivePath ? 0 : 2);
}

const absoluteArchivePath = path.resolve(archivePath);
if (!fs.existsSync(absoluteArchivePath)) {
  throw new Error(`Bundle does not exist: ${absoluteArchivePath}`);
}

const sha256 = (filePath) =>
  createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const errors = [];
const tarList = spawnSync("tar", ["-tzf", absoluteArchivePath], {
  encoding: "utf8",
});
if (tarList.status !== 0) {
  throw new Error(`tar listing failed:\n${tarList.stdout}${tarList.stderr}`);
}

const entries = tarList.stdout
  .split(/\r?\n/u)
  .map((entry) => entry.replace(/^\.\//u, ""))
  .filter((entry) => entry.length > 0);

for (const entry of entries) {
  if (
    path.isAbsolute(entry) ||
    entry.split(/[\\/]/u).includes("..") ||
    entry.includes("\\")
  ) {
    errors.push(`unsafe tar entry: ${entry}`);
  }
}

const compilerPaths = [
  "compiler/contract-info.json",
  "compiler/contract-manifest.json",
];
const circuitPaths = {
  prover: /^keys\/[^/\\]+\.prover$/u,
  verifier: /^keys\/[^/\\]+\.verifier$/u,
  zkir: /^zkir\/[^/\\]+\.bzkir$/u,
};
const allowedCircuitPath = (entry, kind) =>
  typeof entry === "string" && circuitPaths[kind].test(entry);
const allowedCircuitEntry = (entry) =>
  Object.keys(circuitPaths).some((kind) => allowedCircuitPath(entry, kind));
const allowedEntry = (entry) =>
  entry === "manifest.json" ||
  compilerPaths.includes(entry) ||
  allowedCircuitEntry(entry);

for (const entry of entries.filter((entry) => !entry.endsWith("/"))) {
  if (!allowedEntry(entry)) {
    errors.push(`unexpected tar entry: ${entry}`);
  }
}

if (!entries.includes("manifest.json")) {
  errors.push("missing manifest.json");
}

const stagingRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "midnight-did-zk-check-"),
);
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const readJsonObject = (relativePath) => {
  try {
    const value = JSON.parse(
      fs.readFileSync(path.join(stagingRoot, relativePath), "utf8"),
    );
    if (!isObject(value)) throw new Error("expected a JSON object");
    return value;
  } catch (error) {
    errors.push(`${relativePath}: invalid JSON object: ${error.message}`);
    return undefined;
  }
};
const parseVersion = (value, label, bare = false) => {
  try {
    const version = parseCompactCompilerVersion(value);
    if (bare && version !== value) throw new Error("expected a bare version");
    return version;
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
    return undefined;
  }
};
const checkDescriptor = (relativePath, descriptor) => {
  if (
    !isObject(descriptor) ||
    descriptor.type !== "file" ||
    !Number.isSafeInteger(descriptor.size) ||
    descriptor.size < 0 ||
    typeof descriptor.hash !== "string" ||
    descriptor.hash.length !== 64 ||
    !/^[0-9a-f]{64}$/u.test(descriptor.hash)
  ) {
    errors.push(`${relativePath}: invalid compiler file descriptor`);
    return;
  }
  const filePath = path.join(stagingRoot, relativePath);
  if (sha256(filePath) !== descriptor.hash) {
    errors.push(`${relativePath}: compiler descriptor sha256 mismatch`);
  }
  if (fs.statSync(filePath).size !== descriptor.size) {
    errors.push(`${relativePath}: compiler descriptor byte size mismatch`);
  }
};
const checkCompilerMetadata = (manifest) => {
  const version =
    manifest.compactCompilerVersion === undefined
      ? undefined
      : parseVersion(
          manifest.compactCompilerVersion,
          "bundle compiler version",
        );
  const currentCompiler =
    version !== undefined &&
    (BigInt(version.split(".")[0]) > 0n ||
      BigInt(version.split(".")[1]) >= 36n);
  const present = compilerPaths.filter((entry) => entries.includes(entry));
  if (present.length !== 2) {
    if (present.length !== 0 || currentCompiler) {
      errors.push(
        "compiler metadata pair required: contract-info.json and contract-manifest.json",
      );
    }
    // Key-only schema-1 archives remain checkable as legacy data. This says
    // nothing about support for operating their historical ledger/runtime.
    return undefined;
  }
  const info = readJsonObject(compilerPaths[0]);
  const compilerManifest = readJsonObject(compilerPaths[1]);
  if (!info || !compilerManifest) return undefined;
  if (compilerManifest["manifest-version"] !== "1") {
    errors.push("unexpected compiler manifest-version (expected '1')");
  }
  for (const field of [
    "compiler-version",
    "compiler-commit",
    "language-version",
    "runtime-version",
  ]) {
    if (
      typeof compilerManifest[field] !== "string" ||
      compilerManifest[field].length === 0 ||
      info[field] !== compilerManifest[field]
    ) {
      errors.push(`compiler metadata ${field} identity mismatch`);
    }
  }
  const metadataVersion = parseVersion(
    compilerManifest["compiler-version"],
    "metadata compiler-version",
    true,
  );
  for (const field of ["language-version", "runtime-version"]) {
    parseVersion(compilerManifest[field], `metadata ${field}`, true);
  }
  if (version === undefined || version !== metadataVersion) {
    errors.push("bundle/compiler metadata compiler-version mismatch");
  }
  const commit = compilerManifest["compiler-commit"];
  if (
    typeof commit !== "string" ||
    commit.length !== 40 ||
    !/^[0-9a-f]{40}$/u.test(commit)
  ) {
    errors.push("invalid compiler metadata compiler-commit");
  } else if (version !== undefined) {
    // The shared parser already validated the entire banner. Only its Git
    // commit may be abbreviated; compiler versions are always compared exactly.
    const bannerCommit = /\(([0-9a-f]{7,40}) /u.exec(
      manifest.compactCompilerVersion,
    )?.[1];
    if (bannerCommit && commit.slice(0, bannerCommit.length) !== bannerCommit) {
      errors.push("bundle/compiler metadata compiler-commit mismatch");
    }
  }
  if (compilerManifest.compiler?.type !== "directory") {
    errors.push("invalid compiler directory descriptor");
  }
  checkDescriptor(
    compilerPaths[0],
    compilerManifest.compiler?.["contract-info.json"],
  );
  // Check all included provider files, not archive-external compiler outputs
  // or only the subset referenced by manifest.circuits.
  for (const relativePath of entries.filter(allowedCircuitEntry)) {
    const [directory, fileName] = relativePath.split("/");
    if (compilerManifest[directory]?.type !== "directory") {
      errors.push(`${directory}: invalid compiler directory descriptor`);
    }
    checkDescriptor(relativePath, compilerManifest[directory]?.[fileName]);
  }
  // These are internal consistency checks, not an authenticity proof. The
  // archive digest/provenance and SDK integrity checks remain separate gates.
  return compilerManifest;
};
try {
  if (errors.length === 0) {
    const tarExtract = spawnSync(
      "tar",
      ["-xzf", absoluteArchivePath, "-C", stagingRoot],
      { encoding: "utf8" },
    );
    if (tarExtract.status !== 0) {
      errors.push(
        `tar extraction failed:\n${tarExtract.stdout}${tarExtract.stderr}`,
      );
    }
  }

  if (errors.length === 0) {
    const manifest = readJsonObject("manifest.json") ?? {};

    if (manifest.schema !== "midnight-did-zk-artifacts") {
      errors.push(`unexpected manifest schema: ${manifest.schema}`);
    }
    if (manifest.schemaVersion !== 1) {
      errors.push(
        `unexpected manifest schemaVersion: ${manifest.schemaVersion}`,
      );
    }
    if (!Array.isArray(manifest.circuits) || manifest.circuits.length === 0) {
      errors.push("manifest must include at least one circuit");
    }

    checkCompilerMetadata(manifest);
    for (const circuit of Array.isArray(manifest.circuits)
      ? manifest.circuits
      : []) {
      if (!isObject(circuit)) {
        errors.push("invalid circuit metadata object");
        continue;
      }
      for (const kind of ["prover", "verifier", "zkir"]) {
        const relativePath = circuit.files?.[kind];
        const expectedHash = circuit.sha256?.[kind];
        const expectedBytes = circuit.bytes?.[kind];

        if (
          typeof relativePath !== "string" ||
          typeof expectedHash !== "string"
        ) {
          errors.push(`${circuit.id ?? "<unknown>"}: missing ${kind} metadata`);
          continue;
        }

        if (!allowedCircuitPath(relativePath, kind)) {
          errors.push(
            `${circuit.id}: unsafe or unexpected ${kind} path ${relativePath}`,
          );
          continue;
        }

        const filePath = path.join(stagingRoot, relativePath);
        if (!fs.existsSync(filePath)) {
          errors.push(`${circuit.id}: missing ${kind} file ${relativePath}`);
          continue;
        }

        const actualHash = sha256(filePath);
        if (actualHash !== expectedHash) {
          errors.push(`${circuit.id}: ${kind} sha256 mismatch`);
        }

        const actualBytes = fs.statSync(filePath).size;
        if (actualBytes !== expectedBytes) {
          errors.push(`${circuit.id}: ${kind} byte size mismatch`);
        }
      }
    }

    if (errors.length === 0) {
      console.log(
        `[check-zk-artifact-bundle] ${path.basename(absoluteArchivePath)}: ${manifest.circuits.length} circuits verified`,
      );
    }
  }
} finally {
  fs.rmSync(stagingRoot, { force: true, recursive: true });
}

if (errors.length > 0) {
  console.error("[check-zk-artifact-bundle] Bundle validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}
