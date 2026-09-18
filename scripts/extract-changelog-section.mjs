#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

const stableSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const versionHeading =
  /^## \[((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\] - (Unreleased|\d{4}-\d{2}-\d{2})$/u;
const unreleasedHeading = "## [Unreleased]";
const levelTwoHeading = /^##(?:\s|$)/u;
const malformedControl = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u;

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      value == null ||
      !name.startsWith("--") ||
      options.has(name) ||
      !["--version", "--output-file"].includes(name)
    ) {
      fail(
        "Usage: extract-changelog-section.mjs --version VERSION --output-file PATH",
      );
    }
    options.set(name, value);
  }
  if (options.size !== 2) {
    fail("Both --version and --output-file are required.");
  }
  const version = options.get("--version");
  if (!stableSemver.test(version)) {
    fail("Version must be exactly one stable SemVer.");
  }
  return { outputFile: options.get("--output-file"), version };
}

function validateDate(value) {
  if (value === "Unreleased") return;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    fail("Changelog section has an invalid release date.");
  }
}

function validateOutputPath(outputFile, changelogPath) {
  if (
    outputFile.length === 0 ||
    outputFile.startsWith("-") ||
    path.isAbsolute(outputFile) ||
    malformedControl.test(outputFile)
  ) {
    fail("Output path must be a safe repository-relative Markdown path.");
  }
  const normalized = path.normalize(outputFile);
  const components = normalized.split(path.sep);
  if (
    normalized !== outputFile ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith(`..${path.sep}`) ||
    path.extname(normalized) !== ".md" ||
    components.some(
      (component) =>
        !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(component) || component === "..",
    )
  ) {
    fail("Output path must be a safe repository-relative Markdown path.");
  }

  const resolved = path.resolve(normalized);
  const relative = path.relative(process.cwd(), resolved);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    resolved === changelogPath
  ) {
    fail(
      "Output path must remain inside the repository and differ from CHANGELOG.md.",
    );
  }

  let current = process.cwd();
  for (const segment of path.dirname(normalized).split(path.sep)) {
    if (segment === ".") continue;
    current = path.join(current, segment);
    const status = fs.lstatSync(current, { throwIfNoEntry: false });
    if (status == null || !status.isDirectory() || status.isSymbolicLink()) {
      fail("Output parent must be an existing non-symlink directory.");
    }
  }
  const outputStatus = fs.lstatSync(resolved, { throwIfNoEntry: false });
  if (
    outputStatus != null &&
    (!outputStatus.isFile() || outputStatus.isSymbolicLink())
  ) {
    fail("Output file must be a regular non-symlink file.");
  }
  return resolved;
}

function readChangelog(changelogPath) {
  const status = fs.lstatSync(changelogPath, { throwIfNoEntry: false });
  if (status == null || !status.isFile() || status.isSymbolicLink()) {
    fail("CHANGELOG.md must be a regular non-symlink file.");
  }
  const bytes = fs.readFileSync(changelogPath);
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("CHANGELOG.md must contain valid UTF-8.");
  }
  if (source.startsWith("\uFEFF") || malformedControl.test(source)) {
    fail("CHANGELOG.md contains unsupported control characters.");
  }
  return source;
}

function extractChangelogSection(source, version) {
  if (!stableSemver.test(version)) {
    fail("Version must be exactly one stable SemVer.");
  }
  const lines = source.split("\n");
  const sections = [];
  const seenVersions = new Set();
  let sawUnreleased = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!levelTwoHeading.test(line)) continue;
    if (line === unreleasedHeading) {
      if (sawUnreleased) {
        fail("CHANGELOG.md contains duplicate Unreleased sections.");
      }
      sawUnreleased = true;
      sections.push({ index, version: null });
      continue;
    }
    const match = versionHeading.exec(line);
    if (match == null) {
      fail("CHANGELOG.md contains an unexpected level-two heading boundary.");
    }
    validateDate(match[2]);
    if (seenVersions.has(match[1])) {
      fail(`CHANGELOG.md contains duplicate version section ${match[1]}.`);
    }
    seenVersions.add(match[1]);
    sections.push({ index, version: match[1] });
  }

  const matches = sections.filter((section) => section.version === version);
  if (matches.length !== 1) {
    fail(
      `CHANGELOG.md must contain exactly one version section for ${version}.`,
    );
  }
  const start = matches[0].index + 1;
  const next = sections.find((section) => section.index >= start);
  const bodyLines = lines.slice(start, next?.index ?? lines.length);
  while (bodyLines[0]?.trim() === "") bodyLines.shift();
  while (bodyLines.at(-1)?.trim() === "") bodyLines.pop();

  if (bodyLines.length === 0) {
    fail(`CHANGELOG.md section ${version} is empty.`);
  }
  if (
    !bodyLines.some((line) => /^### [^\s].+$/u.test(line)) ||
    !bodyLines.some(
      (line) => line.trim() !== "" && !/^#{1,6}(?:\s|$)/u.test(line),
    ) ||
    bodyLines.some((line) => /^#(?:\s|$)|^###(?:#|\s*$)/u.test(line))
  ) {
    fail(`CHANGELOG.md section ${version} has malformed or empty content.`);
  }
  return `${bodyLines.join("\n")}\n`;
}

function main() {
  const { outputFile, version } = parseArguments(process.argv.slice(2));
  const changelogPath = path.resolve("CHANGELOG.md");
  const outputPath = validateOutputPath(outputFile, changelogPath);
  const source = readChangelog(changelogPath);
  const section = extractChangelogSection(source, version);
  const descriptor = fs.openSync(
    outputPath,
    fs.constants.O_WRONLY |
      fs.constants.O_CREAT |
      fs.constants.O_TRUNC |
      fs.constants.O_NOFOLLOW,
    0o600,
  );
  try {
    fs.writeFileSync(descriptor, section, { encoding: "utf8" });
  } finally {
    fs.closeSync(descriptor);
  }
}

try {
  main();
} catch (error) {
  console.error(`extract-changelog-section: ${error.message}`);
  process.exitCode = 1;
}
