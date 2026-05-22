#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  artifactWorkspaces,
  expectedWorkspaces,
} from "./did-workspace-catalog.mjs";

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

function listFiles(relativeDir) {
  const absoluteDir = fromRoot(relativeDir);
  return readdirSync(absoluteDir).flatMap((entry) => {
    const absolutePath = path.join(absoluteDir, entry);
    const relativePath = path.join(relativeDir, entry);
    if (statSync(absolutePath).isDirectory()) {
      return listFiles(relativePath);
    }
    return [relativePath.split(path.sep).join("/")];
  });
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function assertIncludes(haystack, needle, label) {
  assert(haystack.includes(needle), `${label} must include "${needle}"`);
}

function assertNotIncludes(haystack, needle, label) {
  assert(!haystack.includes(needle), `${label} must not include "${needle}"`);
}

function assertArrayIncludes(array, expected, label) {
  assert(Array.isArray(array), `${label} must be an array`);
  if (Array.isArray(array)) {
    assert(array.includes(expected), `${label} must include "${expected}"`);
  }
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
const libraryWorkspaces = artifactWorkspaces;
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
assert(
  rootPackage.scripts?.["check:managed-artifacts"] ===
    "node scripts/managed-artifact-catalog.mjs --check",
  "package.json must expose check:managed-artifacts",
);
assert(
  rootPackage.scripts?.["test:managed-artifacts"] ===
    "node scripts/managed-artifact-catalog.test.mjs",
  "package.json must expose test:managed-artifacts",
);
assertIncludes(
  rootPackage.scripts?.["ci:core"] ?? "",
  "npm run check:managed-artifacts",
  "ci:core",
);
assertIncludes(
  rootPackage.scripts?.["ci:core"] ?? "",
  "npm run test:managed-artifacts",
  "ci:core",
);
assert(
  rootPackage.scripts?.["build:api-prereqs"] ===
    "npm run build:prepared -w ./packages/contract && npm run build -w ./packages/did && npm run build -w ./packages/api",
  "package.json must expose build:api-prereqs for DID API build dependencies",
);
assertIncludes(
  rootPackage.scripts?.["build:all"] ?? "",
  "npm run build:api-prereqs",
  "build:all",
);
assert(
  rootPackage.scripts?.["build:service-prereqs"] == null,
  "package.json must not reintroduce service-era build:service-prereqs",
);

for (const workspace of [
  ...expectedWorkspaces,
  ...serviceWorkspaces,
]) {
  assertArrayIncludes(rootWorkspaces, workspace, "root package workspaces");
}

const readme = readText("README.md");
const agentGuide = readText("AGENT.md");
for (const workspace of rootWorkspaces) {
  assertIncludes(readme, `\`${workspace}\``, "README workspace matrix");
}
assertIncludes(
  readme,
  "docs/did-surface-change-discipline.md",
  "README developer entry points",
);
for (const requiredPhrase of [
  "`Core (Lint + Contract/Domain/DID)`",
  "`API pipeline`",
  "`Build, Lint, Test, and Coverage`",
  "`Build Docs Site`",
  "`Deploy Docs Site`",
  "`Scan / build`",
  "`Check PR`",
  "`docs-site/spec/midnight-method.md`",
  "`docs-site/spec/midnight-did-traits.md`",
  "`docs/archive/README.md`",
]) {
  assertIncludes(agentGuide, requiredPhrase, "AGENT.md");
}
for (const stalePhrase of [
  "`core`: lint plus contract/domain/DID validation",
  "`services`: API lane",
  "`docs`: docs build",
  "`scan`: security scanning",
  "`pr-check`: semantic PR title",
  "`w3c-spec/midnight-method.md`",
  "`w3c-spec/midnight-did-traits.md`",
]) {
  assertNotIncludes(agentGuide, stalePhrase, "AGENT.md");
}

const changelog = readText("CHANGELOG.md");
assertIncludes(changelog, "DID surface-change discipline", "CHANGELOG.md");

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

const prTemplate = readText(
  ".github/PULL_REQUEST_TEMPLATE/pull_request_template.md",
);
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

const managedArtifactCatalog = readText("scripts/managed-artifact-catalog.mjs");
assertIncludes(
  managedArtifactCatalog,
  "createInputSourceManifest",
  "managed artifact catalog",
);
assertIncludes(
  managedArtifactCatalog,
  "sourceManifest",
  "managed artifact catalog",
);

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

const resolverRepoUrl =
  "https://github.com/midnightntwrk/midnight-did-resolver";
const repositoryBoundaryGuide = readText(
  "docs-site/guide/repository-boundaries.md",
);
assertIncludes(
  repositoryBoundaryGuide,
  resolverRepoUrl,
  "docs-site repository boundary guide",
);
assertIncludes(
  repositoryBoundaryGuide,
  "https://github.com/midnightntwrk/midnight-verifiable-credentials",
  "docs-site repository boundary guide",
);
assertIncludes(
  repositoryBoundaryGuide,
  "https://github.com/midnightntwrk/midnight-trust-registry",
  "docs-site repository boundary guide",
);
assertIncludes(
  readText("docs-site/.vitepress/config.ts"),
  "/guide/repository-boundaries",
  "docs-site sidebar",
);
assertIncludes(
  readText("docs-site/guide/index.md"),
  "/guide/repository-boundaries",
  "docs-site guide index",
);

for (const [docsPath, label] of [
  ["docs-site/index.md", "docs-site landing page"],
  ["docs-site/guide/local-development.md", "docs-site local development guide"],
  ["docs-site/guide/testing-strategy.md", "docs-site testing strategy"],
  ["docs-site/packages/index.md", "docs-site packages overview"],
  ["docs-site/architecture/index.md", "docs-site architecture overview"],
  [
    "docs-site/use-cases/delegated-agent-authorization.md",
    "docs-site delegated-agent use case",
  ],
  [
    "docs-site/use-cases/vc-signing-and-verification.md",
    "docs-site VC signing use case",
  ],
]) {
  assertIncludes(readText(docsPath), resolverRepoUrl, label);
}
assertNotIncludes(
  readText("docs-site/use-cases/index.md"),
  "service-side flows already exist",
  "docs-site use-case overview",
);
assertNotIncludes(
  readText("docs-site/spec/index.md"),
  "package/service docs",
  "docs-site spec index",
);
assertNotIncludes(
  readText("docs-site/spec/midnight-did-traits.md"),
  "package/service docs",
  "docs-site DID traits page",
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
const artifactWorkspaceBridge = readText("scripts/artifact-workspaces.sh");
const upgradeLibs = readText("upgrade-libs.sh");
assertIncludes(
  artifactWorkspaceBridge,
  'node "$DID_WORKSPACE_CATALOG_SCRIPT" --artifact-workspaces',
  "scripts/artifact-workspaces.sh",
);
assertIncludes(
  packArtifacts,
  "did_artifact_workspaces",
  "scripts/pack-artifacts.sh",
);
assertIncludes(upgradeLibs, "did_artifact_workspaces", "upgrade-libs.sh");
assertIncludes(
  upgradeLibs,
  "did_artifact_resolve_destination",
  "upgrade-libs.sh",
);
assert(
  rootPackage.scripts?.["test:artifact-workspaces"] ===
    "node scripts/artifact-workspaces.test.mjs",
  "package.json must expose test:artifact-workspaces",
);
assertIncludes(
  rootPackage.scripts?.["ci:core"] ?? "",
  "npm run test:artifact-workspaces",
  "ci:core",
);

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

  assert(
    packageJson.main === "dist/index.js",
    `${packageLabel} main must point to dist/index.js`,
  );
  assert(
    packageJson.types === "./dist/index.d.ts",
    `${packageLabel} types must point to dist/index.d.ts`,
  );
  assertExportMap(packageJson.exports?.["."], `${packageLabel} root export`, [
    "types",
    "import",
    "default",
  ]);

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

const apiPackage = readJson("packages/api/package.json");
assert(
  apiPackage.scripts?.["typecheck:examples"] ===
    "tsc -p tsconfig.examples.json --noEmit",
  "packages/api/package.json must expose typecheck:examples",
);
assertArrayIncludes(
  apiPackage.files,
  "examples/**",
  "packages/api/package.json files",
);
assertIncludes(
  readText("run-api.sh"),
  "npm run typecheck:examples -w ./packages/api",
  "run-api.sh",
);
assertIncludes(
  readText("run-api.sh"),
  "npm run build:api-prereqs",
  "run-api.sh",
);
assertNotIncludes(
  readText("run-api.sh"),
  "build:service-prereqs",
  "run-api.sh",
);
assertNotIncludes(
  readText("packages/api/src/lightweight.ts"),
  "rxjs",
  "packages/api/src/lightweight.ts",
);
assertNotIncludes(
  readText("packages/api/src/lightweight.ts"),
  "wallet-sdk-facade",
  "packages/api/src/lightweight.ts",
);
assertNotIncludes(
  readText("packages/api/src/api-logger.ts"),
  "lightweight",
  "packages/api/src/api-logger.ts",
);

const apiShimAllowedImporters = {
  deploy: new Set([
    "packages/api/src/contract-lifecycle.ts",
    "packages/api/src/test/compatibility-shims.test.ts",
  ]),
  update: new Set([
    "packages/api/src/did-operations.ts",
    "packages/api/src/test/compatibility-shims.test.ts",
  ]),
};
for (const sourcePath of listFiles("packages/api/src").filter((filePath) =>
  filePath.endsWith(".ts"),
)) {
  const sourceText = readText(sourcePath);
  for (const [shimName, allowedImporters] of Object.entries(
    apiShimAllowedImporters,
  )) {
    if (allowedImporters.has(sourcePath)) {
      continue;
    }
    assert(
      !new RegExp(`["'\`](?:\\.\\.?/)+${shimName}(?:\\.js)?["'\`]`).test(
        sourceText,
      ),
      `${sourcePath} must not import the ${shimName}.ts compatibility shim`,
    );
  }
}

if (failures.length > 0) {
  console.error("DID surface discipline check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("DID surface discipline check passed.");
