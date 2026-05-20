#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(path.dirname(__filename));

const failures = [];

function fromRoot(...parts) {
  return path.join(ROOT_DIR, ...parts);
}

function readText(relativePath) {
  return readFileSync(fromRoot(relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function assertIncludes(haystack, needle, label) {
  assert(haystack.includes(needle), `${label} must include "${needle}"`);
}

function assertArrayIncludes(array, expected, label) {
  assert(Array.isArray(array), `${label} must be an array`);
  if (Array.isArray(array)) {
    assert(
      array.includes(expected),
      `${label} must include "${expected}"`,
    );
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertExportMap(exportMap, label, requiredKeys) {
  assert(
    exportMap && typeof exportMap === "object" && !Array.isArray(exportMap),
    `${label} must be an object export map`,
  );

  if (!exportMap || typeof exportMap !== "object" || Array.isArray(exportMap)) {
    return;
  }

  for (const key of requiredKeys) {
    assert(
      typeof exportMap[key] === "string" && exportMap[key].length > 0,
      `${label} must define a non-empty ${key} target`,
    );
  }
}

const rootPackage = readJson("package.json");
const rootWorkspaces = rootPackage.workspaces ?? [];
const libraryWorkspaces = [
  "packages/api",
  "packages/domain",
  "packages/did",
  "packages/jubjub-schnorr",
  "packages/contract",
];
const serviceWorkspaces = [];

assert(
  rootPackage.scripts?.["check:did-surface-discipline"] ===
    "node scripts/check-did-surface-discipline.mjs",
  "package.json must expose check:did-surface-discipline",
);
assertIncludes(
  rootPackage.scripts?.["ci:core"] ?? "",
  "npm run check:did-surface-discipline",
  "ci:core",
);

for (const workspace of [...libraryWorkspaces, ...serviceWorkspaces, "docs-site"]) {
  assertArrayIncludes(rootWorkspaces, workspace, "root package workspaces");
}

const readme = readText("README.md");
for (const workspace of rootWorkspaces) {
  assertIncludes(readme, `\`${workspace}\``, "README workspace matrix");
}
assertIncludes(
  readme,
  "docs/did-surface-change-discipline.md",
  "README developer entry points",
);

const changelog = readText("CHANGELOG.md");
assertIncludes(
  changelog,
  "DID surface-change discipline",
  "CHANGELOG.md",
);

const contributing = readText("CONTRIBUTING.md");
assertIncludes(
  contributing,
  "DID Surface Change Discipline",
  "CONTRIBUTING.md",
);
assertIncludes(
  contributing,
  "npm run check:did-surface-discipline",
  "CONTRIBUTING.md",
);

const prTemplate = readText(".github/PULL_REQUEST_TEMPLATE/pull_request_template.md");
const targetBranchMatch = prTemplate.match(/Target branch:\s*`([^`]+)`/);
assert(targetBranchMatch, "PR template must declare a target branch");
assert(
  targetBranchMatch?.[1] === "develop",
  "PR template target branch must be develop",
);
assertIncludes(prTemplate, "DID Surface Checklist", "PR template");
assertIncludes(
  prTemplate,
  "Package artifact changes were checked with `npm run check:did-surface-discipline`",
  "PR template",
);

const surfaceGuide = readText("docs/did-surface-change-discipline.md");
for (const requiredPhrase of [
  "Target branch: `develop`",
  "Contract circuits",
  "JubJub verifier",
  "Domain model",
  "DID mapper",
  "API orchestration",
  "Local runners",
  "Packaging",
  "CI and docs",
]) {
  assertIncludes(surfaceGuide, requiredPhrase, "surface discipline guide");
}

const docsGuide = readText("docs-site/guide/did-surface-change-discipline.md");
assertIncludes(docsGuide, "Use `develop`", "docs-site surface guide");
assertIncludes(
  docsGuide,
  "npm run check:did-surface-discipline",
  "docs-site surface guide",
);
assertIncludes(
  readText("docs-site/.vitepress/config.ts"),
  "/guide/did-surface-change-discipline",
  "docs-site sidebar",
);

for (const workflow of [
  ".github/workflows/ci.yml",
  ".github/workflows/docs.yml",
]) {
  const workflowText = readText(workflow);
  assertIncludes(workflowText, "- develop", workflow);
}
assertIncludes(
  readText(".github/workflows/scan.yaml"),
  "branches: [develop, main]",
  ".github/workflows/scan.yaml",
);

assertIncludes(
  readText(".github/workflows/docs.yml"),
  "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'",
  ".github/workflows/docs.yml",
);
assertIncludes(
  readText(".github/workflows/docs.yml"),
  "midnightntwrk/setup-compact-action@v1",
  ".github/workflows/docs.yml",
);

const packArtifacts = readText("scripts/pack-artifacts.sh");
for (const workspace of libraryWorkspaces) {
  assert(
    new RegExp(`^\\s*${escapeRegExp(workspace)}\\s*$`, "m").test(packArtifacts),
    `pack-artifacts workspaces must include "${workspace}"`,
  );
}

const requiredPackageFiles = [
  "dist/**",
  "README.md",
  "package.json",
  "tsconfig.json",
  "tsconfig.build.json",
];

for (const workspace of libraryWorkspaces) {
  const packageJson = readJson(`${workspace}/package.json`);
  const packageLabel = `${workspace}/package.json`;

  assert(packageJson.main === "dist/index.js", `${packageLabel} main must point to dist/index.js`);
  assert(packageJson.types === "./dist/index.d.ts", `${packageLabel} types must point to dist/index.d.ts`);
  assertExportMap(
    packageJson.exports?.["."],
    `${packageLabel} root export`,
    ["types", "import", "default"],
  );

  for (const fileEntry of requiredPackageFiles) {
    assertArrayIncludes(packageJson.files, fileEntry, `${packageLabel} files`);
  }
}

const domainPackage = readJson("packages/domain/package.json");
assertExportMap(
  domainPackage.exports?.["./midnight"],
  "packages/domain/package.json ./midnight export",
  ["types", "import", "default"],
);

const jubjubPackage = readJson("packages/jubjub-schnorr/package.json");
assertExportMap(
  jubjubPackage.exports?.["./managed/jubjub-schnorr/contract"],
  "packages/jubjub-schnorr/package.json generated contract export",
  ["types", "import", "default"],
);
assertArrayIncludes(
  jubjubPackage.files,
  "src/**/*.compact",
  "packages/jubjub-schnorr/package.json files",
);

const contractPackage = readJson("packages/contract/package.json");
assertArrayIncludes(
  contractPackage.files,
  "scripts/*.mjs",
  "packages/contract/package.json files",
);

if (failures.length > 0) {
  console.error("DID surface discipline check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("DID surface discipline check passed.");
