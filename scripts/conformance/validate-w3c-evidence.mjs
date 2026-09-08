#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

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
const evidenceArgument = argument("--evidence");
if (!evidenceArgument) {
  throw new Error(
    "Usage: validate-w3c-evidence.mjs --evidence <path> [--checksum <path>]",
  );
}
const baseline = loadAndValidateBaseline(
  new URL("../../w3c-spec/conformance/external-suites.json", import.meta.url),
);
const evidencePath = resolve(evidenceArgument);
const evidenceBytes = readFileSync(evidencePath);
const evidence = JSON.parse(evidenceBytes);
if (canonicalJson(evidence) !== evidenceBytes.toString("utf8")) {
  throw new Error("External conformance evidence is not canonical JSON");
}
validateEvidence(evidence, baseline);

const checksumPath = resolve(
  argument("--checksum") ?? `${evidencePath}.sha256`,
);
const expectedChecksum = `${sha256(evidenceBytes)}  ${basename(evidencePath)}\n`;
if (readFileSync(checksumPath, "utf8") !== expectedChecksum) {
  throw new Error("External conformance evidence checksum mismatch");
}
