import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..", "..");
const packageWorkspaces = [
  ["api", "@midnight-ntwrk/midnight-did-api"],
  ["domain", "@midnight-ntwrk/midnight-did-domain"],
  ["did", "@midnight-ntwrk/midnight-did"],
  ["jubjub-schnorr", "@midnight-ntwrk/midnight-did-jubjub-schnorr"],
  ["contract", "@midnight-ntwrk/midnight-did-contract"],
];

const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

const requiredMatch = (source, pattern, label) => {
  const match = pattern.exec(source);
  if (!match) throw new Error(`Cannot extract ${label}`);
  return match[1];
};

const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const dependencyPins = (manifests, predicate) =>
  manifests.flatMap(({ manifest, source }) =>
    dependencySections.flatMap((section) =>
      Object.entries(manifest[section] ?? {})
        .filter(([name]) => predicate(name))
        .map(([name, version]) => ({
          name,
          source: `${source}:${section}`,
          version,
        })),
    ),
  );

const consistentPin = (pins, label) => {
  if (pins.length === 0) throw new Error(`Cannot find ${label}`);
  if (new Set(pins.map(({ version }) => version)).size !== 1) {
    throw new Error(
      `${label} pins disagree: ${pins
        .map(({ name, source, version }) => `${source} ${name}=${version}`)
        .join(", ")}`,
    );
  }
  return pins[0].version;
};

const exactDependency = (manifests, packageName) =>
  consistentPin(
    dependencyPins(manifests, (name) => name === packageName),
    `dependency ${packageName}`,
  );

const exactDependencyFamily = (manifests, prefix, label) =>
  consistentPin(
    dependencyPins(manifests, (name) => name.startsWith(prefix)),
    label,
  );

const exactDependencyMap = (manifests, prefix, label) => {
  const pins = dependencyPins(manifests, (name) => name.startsWith(prefix));
  if (pins.length === 0) throw new Error(`Cannot find ${label}`);
  const names = [...new Set(pins.map(({ name }) => name))].sort();
  return Object.fromEntries(
    names.map((name) => [
      name.slice(prefix.length),
      consistentPin(
        pins.filter((pin) => pin.name === name),
        `${label} dependency ${name}`,
      ),
    ]),
  );
};

const readCurrentCompatibilityEvidence = async (root = repoRoot) => {
  const rootPackage = await readJson(resolve(root, "package.json"));
  const workspaceManifests = await Promise.all(
    packageWorkspaces.map(async ([workspace, expectedName]) => {
      const source = `packages/${workspace}/package.json`;
      const manifest = await readJson(resolve(root, source));
      if (manifest.name !== expectedName) {
        throw new Error(
          `Expected ${expectedName} at packages/${workspace}, found ${manifest.name}`,
        );
      }
      return { manifest, source };
    }),
  );
  const manifests = [
    { manifest: rootPackage, source: "package.json" },
    ...workspaceManifests,
  ];
  const workspacePackages = workspaceManifests.map(({ manifest }) => ({
    name: manifest.name,
    version: manifest.version,
  }));
  const coordinatedVersions = new Set(
    workspacePackages.map(({ version }) => version),
  );
  if (
    coordinatedVersions.size !== 1 ||
    !coordinatedVersions.has(rootPackage.version)
  ) {
    throw new Error(
      `DID package versions must all match root version ${rootPackage.version}`,
    );
  }

  const [
    ciWorkflow,
    publishWorkflow,
    qualityWorkflow,
    didCompact,
    jubjubCompact,
    nodeVersion,
  ] = await Promise.all([
    readFile(resolve(root, ".github/workflows/ci.yml"), "utf8"),
    readFile(resolve(root, ".github/workflows/publish.yml"), "utf8"),
    readFile(resolve(root, ".github/workflows/quality.yml"), "utf8"),
    readFile(resolve(root, "packages/contract/src/did.compact"), "utf8"),
    readFile(
      resolve(root, "packages/jubjub-schnorr/src/jubjub-schnorr.compact"),
      "utf8",
    ),
    readFile(resolve(root, ".nvmrc"), "utf8"),
  ]);

  const compactCompiler = consistentPin(
    [
      ["CI", ciWorkflow],
      ["publish", publishWorkflow],
      ["quality", qualityWorkflow],
    ].map(([name, workflow]) => ({
      name: "COMPACT_COMPILER_VERSION",
      source: `.github/workflows/${name === "CI" ? "ci" : name}.yml`,
      version: requiredMatch(
        workflow,
        /^\s*COMPACT_COMPILER_VERSION:\s*([^\s#]+)\s*$/mu,
        `${name} Compact compiler version`,
      ),
    })),
    "Compact compiler",
  );

  const midnightJsFamily = exactDependencyFamily(
    manifests,
    "@midnight-ntwrk/midnight-js-",
    "Midnight JS package family",
  );
  const walletSdk = exactDependencyMap(
    manifests,
    "@midnight-ntwrk/wallet-sdk-",
    "wallet SDK",
  );

  return {
    version: rootPackage.version,
    nodeMajor: nodeVersion.trim(),
    pnpm: requiredMatch(
      rootPackage.packageManager ?? "",
      /^pnpm@(.+)$/u,
      "pnpm package-manager pin",
    ),
    compactCompiler,
    didLanguagePragma: requiredMatch(
      didCompact,
      /^pragma language_version\s+(.+);$/mu,
      "DID Compact language pragma",
    ),
    jubjubLanguagePragma: requiredMatch(
      jubjubCompact,
      /^pragma language_version\s+(.+);$/mu,
      "Jubjub Compact language pragma",
    ),
    compactRuntime: exactDependency(
      manifests,
      "@midnight-ntwrk/compact-runtime",
    ),
    compactJs: exactDependency(manifests, "@midnight-ntwrk/compact-js"),
    ledger: `@midnight-ntwrk/ledger-v8@${exactDependency(
      manifests,
      "@midnight-ntwrk/ledger-v8",
    )}`,
    midnightJsFamily,
    walletSdk,
    proofServer: requiredMatch(
      ciWorkflow,
      /['"](midnightntwrk\/proof-server:[^'"]+)['"]/u,
      "CI proof-server image",
    ),
    packageVersions: Object.fromEntries(
      workspacePackages.map(({ name, version }) => [name, version]),
    ),
  };
};

const currentEvidenceFields = [
  "version",
  "nodeMajor",
  "pnpm",
  "compactCompiler",
  "didLanguagePragma",
  "jubjubLanguagePragma",
  "compactRuntime",
  "compactJs",
  "ledger",
  "midnightJsFamily",
  "walletSdk",
  "proofServer",
];

const assertCurrentBaselineMatchesEvidence = (evidence, baseline) => {
  const mismatches = currentEvidenceFields.filter(
    (field) => !isDeepStrictEqual(evidence[field], baseline[field]),
  );
  if (mismatches.length > 0) {
    throw new Error(
      `Current compatibility baseline ${baseline.version} is stale for: ${mismatches.join(
        ", ",
      )}. Update compatibility-baselines.json with reviewed release evidence.`,
    );
  }

  const packageVersionMismatches = Object.entries(evidence.packageVersions)
    .filter(([, version]) => version !== baseline.version)
    .map(([name]) => name);
  if (packageVersionMismatches.length > 0) {
    throw new Error(
      `Published package baseline is not coordinated for: ${packageVersionMismatches.join(
        ", ",
      )}`,
    );
  }
};

const coordinatedPackages = (version) =>
  packageWorkspaces.map(([, name]) => `\`${name}@${version}\``).join("<br>");

const walletSdkCell = (walletSdk) =>
  Object.entries(walletSdk)
    .map(
      ([name, version]) => `\`@midnight-ntwrk/wallet-sdk-${name}@${version}\``,
    )
    .join("<br>");

const releaseCell = (baseline) =>
  `[\`${baseline.releaseTag}\`](https://github.com/midnightntwrk/midnight-did/releases/tag/${baseline.releaseTag}) → [\`${baseline.sourceCommit}\`](https://github.com/midnightntwrk/midnight-did/commit/${baseline.sourceCommit})`;

const zkReleaseCell = (version) =>
  `[\`v${version}\`](https://github.com/midnightntwrk/midnight-did/releases/tag/v${version}) / [\`midnight-did-zk-artifacts-${version}.tar.gz\`](https://github.com/midnightntwrk/midnight-did/releases/download/v${version}/midnight-did-zk-artifacts-${version}.tar.gz)`;

const matrixRow = (label, baselines, value) =>
  `| ${label} | ${baselines.map(value).join(" | ")} |`;

const generateCompatibilityMarkdown = (baselines, currentRelease) => {
  const current = baselines.find(({ version }) => version === currentRelease);
  if (!current) throw new Error(`Missing current release ${currentRelease}`);

  const rows = [
    matrixRow("Recommended status wording", baselines, (item) => item.status),
    matrixRow("Coordinated package set", baselines, (item) =>
      coordinatedPackages(item.version),
    ),
    matrixRow("Release tag / source commit", baselines, releaseCell),
    matrixRow(
      "Node tested baseline",
      baselines,
      (item) => `Major \`${item.nodeMajor}\``,
    ),
    matrixRow("pnpm tested baseline", baselines, (item) => `\`${item.pnpm}\``),
    matrixRow(
      "Compact compiler",
      baselines,
      (item) => `\`${item.compactCompiler}\``,
    ),
    matrixRow(
      "DID Compact pragma",
      baselines,
      (item) => `\`${item.didLanguagePragma}\``,
    ),
    matrixRow(
      "Jubjub wrapper pragma",
      baselines,
      (item) => `\`${item.jubjubLanguagePragma}\``,
    ),
    matrixRow(
      "\`compact-runtime\`",
      baselines,
      (item) => `\`${item.compactRuntime}\``,
    ),
    matrixRow("\`compact-js\`", baselines, (item) => `\`${item.compactJs}\``),
    matrixRow(
      "Ledger generation/package",
      baselines,
      (item) => `\`${item.ledger}\``,
    ),
    matrixRow(
      "Midnight JS package family",
      baselines,
      (item) => `\`${item.midnightJsFamily}\``,
    ),
    matrixRow("Wallet SDK baseline", baselines, (item) =>
      walletSdkCell(item.walletSdk),
    ),
    matrixRow(
      "Proof-server reference",
      baselines,
      (item) => `\`${item.proofServer}\``,
    ),
    matrixRow("Public ZK release", baselines, (item) =>
      zkReleaseCell(item.version),
    ),
    matrixRow(
      "GHCR coordinate",
      baselines,
      (item) =>
        `\`ghcr.io/midnightntwrk/midnight-did-zk-artifacts:${item.version}\``,
    ),
  ].join("\n");

  return `# Compatibility and Release Baselines

This page records **tested release baselines**, not open-ended compatibility
ranges. **Current** means the latest published DID package and ZK artifact set
that this repository release-tested. **Compatibility reference** records a
legacy release for migration comparison only; it does not imply continuing
support.

Published npm manifests and matching release artifacts are authoritative for
published package identities. Manifest \`engines\`, Compact language pragmas,
and similar constraints describe admissible inputs; this matrix does not infer
support for newer Node, pnpm, Compact, Midnight JS, wallet SDK, ledger, or
proof-server versions. Re-test the complete integration before moving any component
beyond the exact baseline below.

This page is generated from
[\`docs-site/data/compatibility-baselines.json\`](https://github.com/midnightntwrk/midnight-did/blob/main/docs-site/data/compatibility-baselines.json)
and current repository pins. Edit the source data or owning manifests and run
\`pnpm --filter docs-site docs:sync-compatibility\`; do not edit this page by
hand.

## Evidence-backed matrix

<!-- prettier-ignore -->
| Evidence-backed baseline | ${baselines.map((item) => `DID ${item.version}`).join(" | ")} |
| --- | ${baselines.map(() => "---").join(" | ")} |
${rows}

The GHCR coordinates identify matching generic OCI artifacts. Registry access
requires Midnight organization access and GitHub Container Registry
authentication; the linked GitHub Release archives are the public download
path.

## 0.5.0 publication-manifest caveat

The \`v0.5.0\` source tag reports version
\`${baselines[0].sourceManifestVersion}\` in the root and workspace manifests,
while npm and the immutable GitHub Release artifacts identify all five packages
as \`0.5.0\`. The publication pipeline rewrites root/workspace versions before
packing without committing those rewrites. This matrix therefore uses npm
metadata and release artifacts as authority for the published \`0.5.0\` package
identities, and uses tagged source only for its release-tested toolchain and
runtime pins. Dependency similarity, \`engines\`, and language pragmas must not
be read as broader compatibility guarantees.

## Keeping the matrix current

The generator derives the ${current.version} row's repository-owned pins from
\`.nvmrc\`, the exact pnpm package-manager pin, root/workspace manifests, CI,
quality, and publish workflow constants, and both Compact language pragmas.
Generation fails when those inputs drift from the reviewed machine-readable
baseline. Add or
update a reviewed release baseline rather than silently carrying old evidence
forward.
`;
};

const loadCompatibilityBaselines = async (root = repoRoot) =>
  readJson(resolve(root, "docs-site/data/compatibility-baselines.json"));

const buildCompatibilityPage = async (root = repoRoot) => {
  const source = await loadCompatibilityBaselines(root);
  const evidence = await readCurrentCompatibilityEvidence(root);
  const current = source.baselines.find(
    ({ version }) => version === source.currentRelease,
  );
  if (!current) {
    throw new Error(`Missing current baseline ${source.currentRelease}`);
  }
  assertCurrentBaselineMatchesEvidence(evidence, current);
  return {
    content: generateCompatibilityMarkdown(
      source.baselines,
      source.currentRelease,
    ),
    evidence,
    source,
  };
};

const syncCompatibilityPage = async ({
  root = repoRoot,
  check = false,
} = {}) => {
  const targetPath = resolve(root, "docs-site/guide/compatibility.md");
  const result = await buildCompatibilityPage(root);
  if (check) {
    const existing = await readFile(targetPath, "utf8").catch(() => "");
    if (existing !== result.content) {
      throw new Error(
        "docs-site/guide/compatibility.md is stale; run pnpm --filter docs-site docs:sync-compatibility",
      );
    }
    return { ...result, targetPath };
  }
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, result.content, "utf8");
  return { ...result, targetPath };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await syncCompatibilityPage({ check: process.argv.includes("--check") });
}

export {
  assertCurrentBaselineMatchesEvidence,
  buildCompatibilityPage,
  generateCompatibilityMarkdown,
  loadCompatibilityBaselines,
  readCurrentCompatibilityEvidence,
  syncCompatibilityPage,
};
