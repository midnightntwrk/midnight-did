#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const statementType = "https://in-toto.io/Statement/v0.1";
const predicateType = "https://slsa.dev/provenance/v0.2";
const buildType =
  "https://github.com/slsa-framework/slsa-github-generator/generic@v1";

function fail(message) {
  throw new Error(message);
}

function isRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function parseArguments(argv) {
  const options = { assets: [] };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (value == null) fail("Malformed provenance-verification arguments.");
    if (name === "--asset") options.assets.push(value);
    else if (
      [
        "--verified-json",
        "--github-sha",
        "--source-ref",
        "--source-repo",
        "--builder-id",
        "--entry-point",
        "--channel",
        "--version",
        "--rc-index",
      ].includes(name) &&
      options[name.slice(2)] == null
    ) {
      options[name.slice(2)] = value;
    } else fail("Malformed provenance-verification arguments.");
  }
  const required = [
    "verified-json",
    "github-sha",
    "source-ref",
    "source-repo",
    "builder-id",
    "entry-point",
    "channel",
    "version",
    "rc-index",
  ];
  if (
    required.some((name) => options[name] == null) ||
    options.assets.length === 0
  ) {
    fail("Incomplete provenance-verification arguments.");
  }
  if (!/^[0-9a-f]{40}$/u.test(options["github-sha"])) {
    fail("Expected source commit must be a lowercase 40-character SHA-1.");
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(options["source-repo"])) {
    fail("Expected source repository is malformed.");
  }
  return options;
}

function readVerifiedStatement(file) {
  let document;
  try {
    document = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(fs.readFileSync(file)),
    );
  } catch {
    fail("Verified provenance output is malformed.");
  }
  if (Array.isArray(document)) {
    if (document.length !== 1) fail("Verified provenance output is ambiguous.");
    [document] = document;
  }
  if (!isRecord(document) || !isRecord(document.verificationResult)) {
    fail("Verified provenance output is malformed.");
  }
  const statement = document.verificationResult.statement;
  if (!isRecord(statement)) fail("Verified provenance statement is malformed.");
  return statement;
}

function expectedSubjects(assets) {
  const result = new Map();
  for (const asset of assets) {
    const name = path.basename(asset);
    if (
      name.length === 0 ||
      name.endsWith(".intoto.jsonl") ||
      result.has(name) ||
      !fs.statSync(asset).isFile()
    ) {
      fail("Expected provenance assets are malformed or duplicated.");
    }
    const sha256 = createHash("sha256")
      .update(fs.readFileSync(asset))
      .digest("hex");
    result.set(name, sha256);
  }
  return result;
}

function verifySubjects(subjects, expected) {
  if (!Array.isArray(subjects) || subjects.length !== expected.size) {
    fail("Provenance subject set differs from the release assets.");
  }
  const actual = new Map();
  for (const subject of subjects) {
    if (
      !isRecord(subject) ||
      typeof subject.name !== "string" ||
      !isRecord(subject.digest) ||
      Object.keys(subject.digest).length !== 1 ||
      typeof subject.digest.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(subject.digest.sha256) ||
      actual.has(subject.name)
    ) {
      fail("Provenance subject set is malformed or duplicated.");
    }
    actual.set(subject.name, subject.digest.sha256);
  }
  for (const [name, sha256] of expected) {
    if (actual.get(name) !== sha256) {
      fail("Provenance subject set differs from the release assets.");
    }
  }
}

function exactInputs(value, expected) {
  if (!isRecord(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]) &&
    expectedKeys.every((key) => value[key] === expected[key])
  );
}

function verifySource(statement, options) {
  const predicate = statement.predicate;
  const invocation = predicate?.invocation;
  const configSource = invocation?.configSource;
  const environment = invocation?.environment;
  const eventPayload = environment?.github_event_payload;
  const sourceUri = `git+https://github.com/${options["source-repo"]}@${options["source-ref"]}`;
  const expectedInputs = {
    channel: options.channel,
    rc_index: options["rc-index"],
    version: options.version,
  };

  if (
    statement._type !== statementType ||
    statement.predicateType !== predicateType ||
    !isRecord(predicate) ||
    predicate.buildType !== buildType ||
    predicate.builder?.id !== options["builder-id"] ||
    configSource?.uri !== sourceUri ||
    configSource?.entryPoint !== options["entry-point"] ||
    !isRecord(configSource?.digest) ||
    Object.keys(configSource.digest).length !== 1 ||
    configSource.digest.sha1 !== options["github-sha"] ||
    !exactInputs(invocation?.parameters?.event_inputs, expectedInputs) ||
    environment?.github_event_name !== "workflow_dispatch" ||
    environment?.github_ref !== options["source-ref"] ||
    environment?.github_sha1 !== options["github-sha"] ||
    eventPayload?.ref !== options["source-ref"] ||
    eventPayload?.repository?.full_name !== options["source-repo"] ||
    !exactInputs(eventPayload?.inputs, expectedInputs) ||
    !Array.isArray(predicate.materials) ||
    predicate.materials.length !== 1 ||
    predicate.materials[0]?.uri !== sourceUri ||
    !isRecord(predicate.materials[0]?.digest) ||
    Object.keys(predicate.materials[0].digest).length !== 1 ||
    predicate.materials[0].digest.sha1 !== options["github-sha"]
  ) {
    fail(
      "Provenance source, builder, workflow, event, or release inputs differ.",
    );
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const statement = readVerifiedStatement(options["verified-json"]);
  verifySubjects(statement.subject, expectedSubjects(options.assets));
  verifySource(statement, options);
}

try {
  main();
} catch (error) {
  console.error(`verify-slsa-provenance: ${error.message}`);
  process.exitCode = 1;
}
