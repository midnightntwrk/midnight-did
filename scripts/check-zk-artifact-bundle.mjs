#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

const allowedEntry = (entry) =>
  entry === "manifest.json" ||
  /^keys\/[^/]+\.(prover|verifier)$/u.test(entry) ||
  /^zkir\/[^/]+\.bzkir$/u.test(entry);

for (const entry of entries.filter((entry) => !entry.endsWith("/"))) {
  if (!allowedEntry(entry)) {
    errors.push(`unexpected tar entry: ${entry}`);
  }
}

if (!entries.includes("manifest.json")) {
  errors.push("missing manifest.json");
}

const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "midnight-did-zk-check-"));
try {
  if (errors.length === 0) {
    const tarExtract = spawnSync(
      "tar",
      ["-xzf", absoluteArchivePath, "-C", stagingRoot],
      { encoding: "utf8" },
    );
    if (tarExtract.status !== 0) {
      errors.push(`tar extraction failed:\n${tarExtract.stdout}${tarExtract.stderr}`);
    }
  }

  if (errors.length === 0) {
    const manifestPath = path.join(stagingRoot, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    if (manifest.schema !== "midnight-did-zk-artifacts") {
      errors.push(`unexpected manifest schema: ${manifest.schema}`);
    }
    if (manifest.schemaVersion !== 1) {
      errors.push(`unexpected manifest schemaVersion: ${manifest.schemaVersion}`);
    }
    if (!Array.isArray(manifest.circuits) || manifest.circuits.length === 0) {
      errors.push("manifest must include at least one circuit");
    }

    for (const circuit of manifest.circuits ?? []) {
      for (const kind of ["prover", "verifier", "zkir"]) {
        const relativePath = circuit.files?.[kind];
        const expectedHash = circuit.sha256?.[kind];
        const expectedBytes = circuit.bytes?.[kind];

        if (typeof relativePath !== "string" || typeof expectedHash !== "string") {
          errors.push(`${circuit.id ?? "<unknown>"}: missing ${kind} metadata`);
          continue;
        }

        if (!allowedEntry(relativePath)) {
          errors.push(`${circuit.id}: unsafe or unexpected ${kind} path ${relativePath}`);
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
