#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { basename, resolve, sep } from "node:path";

import {
  canonicalJson,
  loadAndValidateBaseline,
  sha256,
  validateEvidence,
} from "./external-conformance-lib.mjs";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const evidencePath = argument("--evidence");
if (!evidencePath) {
  throw new Error(
    "Usage: validate-w3c-evidence.mjs --evidence <path> [--artifacts-dir <path>]",
  );
}
const baseline = loadAndValidateBaseline(
  new URL("../../w3c-spec/conformance/external-suites.json", import.meta.url),
);
const evidenceBytes = readFileSync(resolve(evidencePath));
const evidence = JSON.parse(evidenceBytes);
if (canonicalJson(evidence) !== evidenceBytes.toString("utf8")) {
  throw new Error("External conformance evidence is not canonical JSON");
}
validateEvidence(evidence, baseline);

const artifactsDirectory = argument("--artifacts-dir");
if (artifactsDirectory) {
  const root = resolve(artifactsDirectory);
  const artifact = (path) => {
    if (basename(path) !== path) {
      throw new Error(`External evidence artifact path is not local: ${path}`);
    }
    const absolute = resolve(root, path);
    if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
      throw new Error(
        `External evidence artifact escapes output root: ${path}`,
      );
    }
    return readFileSync(absolute);
  };
  const fixtureDigest = sha256(artifact(evidence.fixture.path));
  if (fixtureDigest !== evidence.fixture.sha256) {
    throw new Error("External conformance fixture checksum mismatch");
  }
  for (const suite of evidence.suites) {
    const rawDigest = sha256(artifact(suite.rawOutput));
    if (rawDigest !== suite.rawOutputSha256) {
      throw new Error(
        `External conformance raw output checksum mismatch: ${suite.name}`,
      );
    }
  }
}
