#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

function parseMajorMinor(version) {
  const match = String(version).match(/(\d+)(?:\.(\d+))?/);
  if (!match) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  return { major: Number(match[1]), minor: Number(match[2] ?? "0") };
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const engines = pkg.engines || {};

const minNode = parseMajorMinor(engines.node || "24.0");
const minNpm = parseMajorMinor(engines.npm || "10.0");

const currentNode = process.versions.node;
const currentNpm = execSync("npm --version", {
  encoding: "utf8",
  stdio: "pipe",
}).trim();

function satisfies(min, actual) {
  return actual.major > min.major || (actual.major === min.major && actual.minor >= min.minor);
}

const currentNodeVersion = parseMajorMinor(currentNode);
const currentNpmVersion = parseMajorMinor(currentNpm);

if (!satisfies(minNode, currentNodeVersion)) {
  console.error(
    `Node.js ${currentNode} does not satisfy engine minimum ${engines.node}.` +
      " Update Node.js before running the pipeline.",
  );
  process.exit(1);
}

if (!satisfies(minNpm, currentNpmVersion)) {
  console.error(
    `npm ${currentNpm} does not satisfy engine minimum ${engines.npm}.` +
      " Update npm before running the pipeline.",
  );
  process.exit(1);
}

if (!existsSync(".nvmrc")) {
  console.error("Missing .nvmrc at repository root.");
  process.exit(1);
}

if (!existsSync(".npmrc")) {
  console.log("No .npmrc found; continuing with npm defaults.");
}

if (!existsSync("package-lock.json")) {
  console.error("Missing package-lock.json. Run npm ci in a fresh install to regenerate it.");
  process.exit(1);
}

const declaredCompactRuntime = pkg.dependencies?.["@midnight-ntwrk/compact-runtime"];
const expectedCompactCompiler = process.env.COMPACT_COMPILER_VERSION ?? "0.30.0";

if (declaredCompactRuntime == null) {
  console.error(
    "Missing @midnight-ntwrk/compact-runtime in root dependencies; " +
      "cannot verify Compact compiler/runtime compatibility.",
  );
  process.exit(1);
}

let compactCompilerVersion;
try {
  compactCompilerVersion = execSync("compact compile --version", {
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
} catch (error) {
  console.error(
    "Unable to read Compact compiler version. " +
      "Install the Compact compiler before running the pipeline.",
  );
  process.exit(1);
}

if (compactCompilerVersion !== expectedCompactCompiler) {
  console.error(
    `Compact compiler mismatch: compact compile --version returned ${compactCompilerVersion}, ` +
      `but COMPACT_COMPILER_VERSION expects ${expectedCompactCompiler}. ` +
      "Update the CI compiler pin or local compiler before running contract tests.",
  );
  process.exit(1);
}

let compilerRuntime;
try {
  compilerRuntime = execSync("compact compile --runtime-version", {
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
} catch (error) {
  console.error(
    "Unable to read Compact compiler runtime version. " +
      "Install the Compact compiler before running the pipeline.",
  );
  process.exit(1);
}

if (declaredCompactRuntime !== compilerRuntime) {
  console.error(
    `Compact compiler/runtime mismatch: compiler emits ${compilerRuntime}, ` +
      `but package.json declares @midnight-ntwrk/compact-runtime ${declaredCompactRuntime}. ` +
      "Update the compiler pin or runtime dependency before running contract tests.",
  );
  process.exit(1);
}

console.log("Toolchain precheck passed.");
