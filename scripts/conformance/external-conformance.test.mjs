import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { load as loadYaml } from "js-yaml";

import { withMode0700TemporaryDirectory } from "./acquire-w3c-did-test-suite.mjs";
import {
  prepareConformanceOutputPath,
  validateConformanceOutputPath,
} from "./destructive-output-path.mjs";
import {
  assertCleanExactHead,
  canonicalJson,
  hashDirectory,
  loadAndValidateBaseline,
  sha256,
  validateEvidence,
} from "./external-conformance-lib.mjs";
import {
  buildLinuxSandboxCommand,
  linuxNetworkSandboxCommand,
  networkDeniedCommand,
} from "./network-sandbox.mjs";
import { generateFixture } from "../../packages/did/scripts/generate-w3c-fixture.mjs";

const root = new URL("../../", import.meta.url);
const baselineUrl = new URL(
  "../../w3c-spec/conformance/external-suites.json",
  import.meta.url,
);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const document = {
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/jwk/v1",
  ],
  id: `did:midnight:devnet:${"a".repeat(64)}`,
  controller: `did:midnight:devnet:${"a".repeat(64)}`,
  verificationMethod: [
    {
      id: `did:midnight:devnet:${"a".repeat(64)}#key-1`,
      type: "JsonWebKey",
      controller: `did:midnight:devnet:${"a".repeat(64)}`,
      publicKeyJwk: {
        crv: "Ed25519",
        kty: "OKP",
        x: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
      },
    },
  ],
  authentication: [`did:midnight:devnet:${"a".repeat(64)}#key-1`],
};

const fakePublicApi = () => {
  const calls = [];
  const encoder = new TextEncoder();
  const withoutContext = { ...document };
  delete withoutContext["@context"];
  return {
    calls,
    api: {
      MidnightNetwork: { DevNet: "devnet" },
      MidnightDIDResolver: class {
        constructor(options) {
          calls.push(["constructor", options]);
        }
        async resolveDIDResolutionResult(did) {
          calls.push(["resolveDIDResolutionResult", did]);
          return {
            didDocument: document,
            didDocumentMetadata: {
              created: "1970-01-01T00:00:01Z",
              versionId: "1",
            },
            didResolutionMetadata: {},
          };
        }
        async resolveRepresentation(did, options) {
          calls.push(["resolveRepresentation", did, options]);
          const jsonLd = options.accept === "application/did+ld+json";
          return {
            didDocumentStream: encoder.encode(
              JSON.stringify(jsonLd ? document : withoutContext),
            ),
            didDocumentMetadata: {
              created: "1970-01-01T00:00:01Z",
              versionId: "1",
            },
            didResolutionMetadata: { contentType: options.accept },
          };
        }
      },
      parseMidnightDIDDocument(input) {
        calls.push(["parseMidnightDIDDocument", input]);
        assert.deepEqual(input, document);
        return input;
      },
    },
  };
};

const createValidEvidence = (baseline, commit = "a".repeat(40)) => ({
  schemaVersion: "1.0.0",
  claim: baseline.claim,
  repository: { commit, clean: true },
  packages: {
    root: "midnight-did@0.6.0",
    did: "@midnight-ntwrk/midnight-did@0.6.0",
    contract: "@midnight-ntwrk/midnight-did-contract@0.6.0",
  },
  toolchains: {
    node: `v${baseline.toolchains.node}`,
    npm: baseline.toolchains.npm,
    pnpm: baseline.toolchains.pnpm,
    nix: "nix (Nix) 2.0.0",
    compact: baseline.toolchains.compact,
  },
  standards: baseline.standards,
  upstream: baseline.upstream,
  adapter: {
    acquisitionSha256: "0".repeat(64),
    generatorSha256: "b".repeat(64),
    librarySha256: "c".repeat(64),
    resourceLimits: baseline.upstream.runtime.resourceLimits,
    sandbox: "test-network-denied",
    sandboxSha256: "8".repeat(64),
    runnerSha256: "9".repeat(64),
    setupSha256: "d".repeat(64),
    sha256: "e".repeat(64),
    validatorSha256: "f".repeat(64),
    version: "1.0.0",
  },
  fixture: { sha256: "1".repeat(64), path: "fixture.json" },
  selectedSuites: baseline.selectedSuites,
  suiteLabels: baseline.suiteLabels,
  expectedAssertions: baseline.expectedAssertions,
  excludedSuites: baseline.excludedSuites,
  suites: baseline.selectedSuites.map((name) => ({
    name,
    assertions: Array.from(
      { length: baseline.expectedAssertions[name] },
      (_, index) => ({
        ancestors: [name],
        status: "passed",
        title: `assertion ${index + 1}`,
      }),
    ),
    rawOutput: `${name}.json`,
    rawOutputSha256: "2".repeat(64),
    totals: {
      failed: 0,
      passed: baseline.expectedAssertions[name],
      pending: 0,
      skipped: 0,
      todo: 0,
      total: baseline.expectedAssertions[name],
    },
  })),
  totals: {
    failed: 0,
    passed: Object.values(baseline.expectedAssertions).reduce(
      (sum, count) => sum + count,
      0,
    ),
    pending: 0,
    skipped: 0,
    todo: 0,
    total: Object.values(baseline.expectedAssertions).reduce(
      (sum, count) => sum + count,
      0,
    ),
  },
  limitations: baseline.limitations,
  registry: baseline.registry,
  upstreamRuntime: {
    archiveSha256: baseline.upstream.archiveSha256,
    commit: baseline.upstream.commit,
    ephemeral: true,
    installedLockfiles: baseline.upstream.runtime.installedLockfiles,
    lifecycleScripts: "disabled",
    matcherSourceSha256: baseline.upstream.runtime.matcherSourceSha256,
    node: `v${baseline.toolchains.node}`,
    npm: baseline.toolchains.npm,
    packageCount: 1,
    packageInventorySha256: "3".repeat(64),
    platform: "linux",
    runtimeSha256: "4".repeat(64),
    sandboxPrivilegePolicy: "drop-before-external-exec-v1",
    sandboxSha256: "8".repeat(64),
    sourceAllowlist: baseline.upstream.runtime.sourceAllowlist,
    sourceSha256: baseline.upstream.runtime.allowlistedSourceSha256,
    temporaryRootMode: "0700",
  },
});

test("tracked baseline pins exact source, dependencies, license, suites, and open decisions", () => {
  const baseline = loadAndValidateBaseline(baselineUrl, {
    packageJsonUrl: new URL("../../package.json", import.meta.url),
  });
  assert.equal(
    baseline.upstream.commit,
    "939b31d07d5b1699340ac0702ec0fa46ffcdef0a",
  );
  assert.equal(
    baseline.upstream.archiveSha256,
    "c4e464d3f49d265a4023f646a77db7abc0992ff844d3055c180cd1c1c86717bd",
  );
  assert.equal(
    baseline.upstream.extractedTreeSha256,
    "bacdbd9ed79bbe772383f99b8df39c037bc6ee8a49622ca33de77c73be55526c",
  );
  assert.equal(
    baseline.upstream.runtime.allowlistedSourceSha256,
    "3690c1123ed5bf94a7aac5d271c7b323336019a99ce7ec6a0567ecb456f28a49",
  );
  assert.equal(
    baseline.upstream.runtime.matcherSourceSha256,
    "331f01f8bf654864ee6ddb2e99d6d63296062b14a457dcf9681c4eb2e0b74031",
  );
  assert.equal(Object.keys(baseline.upstream.lockfiles).length, 3);
  assert.equal(baseline.toolchains.node, "24.18.1");
  assert.equal(baseline.toolchains.npm, "11.16.0");
  assert.equal(baseline.upstream.runtime.platform, "linux-only");
  assert.equal(baseline.upstream.runtime.lifecycleScripts, "disabled");
  assert.equal(
    baseline.upstream.runtime.snapshotRetention,
    "ephemeral-temporary-directory-removed-after-execution",
  );
  assert.equal(baseline.upstream.license.approvalStatus, "approved");
  assert.equal(
    baseline.registry.status,
    "decision-pending-ownership-confirmation",
  );
  assert.equal(baseline.registry.humanConfirmationRequired, true);
});

test("trusted fixture generation is deterministic and uses declared public package calls", async () => {
  const firstApi = fakePublicApi();
  const secondApi = fakePublicApi();
  const first = await generateFixture(firstApi.api);
  const second = await generateFixture(secondApi.api);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.deepEqual(
    firstApi.calls.map(([name]) => name),
    [
      "constructor",
      "resolveDIDResolutionResult",
      "resolveRepresentation",
      "resolveRepresentation",
      "parseMidnightDIDDocument",
    ],
  );
  assert.equal(first.conformingConsumers.length, 2);
  assert.equal(first.dids.length, 1);
});

test("trusted evidence validation fails closed on status, count, runtime, and identity drift", () => {
  const baseline = loadAndValidateBaseline(baselineUrl, {
    packageJsonUrl: new URL("../../package.json", import.meta.url),
  });
  const valid = createValidEvidence(baseline);
  assert.doesNotThrow(() => validateEvidence(valid, baseline));
  for (const field of ["failed", "pending", "skipped", "todo"]) {
    const invalid = structuredClone(valid);
    invalid.suites[0].totals[field] = 1;
    invalid.suites[0].totals.total += 1;
    assert.throws(() => validateEvidence(invalid, baseline), new RegExp(field));
  }
  const missing = structuredClone(valid);
  missing.suites.pop();
  assert.throws(() => validateEvidence(missing, baseline), /selected suites/u);
  const persistent = structuredClone(valid);
  persistent.upstreamRuntime.ephemeral = false;
  assert.throws(
    () => validateEvidence(persistent, baseline),
    /ephemeral runtime/u,
  );
  const changedAllowlist = structuredClone(valid);
  changedAllowlist.upstreamRuntime.sourceSha256 = "0".repeat(64);
  assert.throws(
    () => validateEvidence(changedAllowlist, baseline),
    /source allowlist/u,
  );
});

test("exact-head guard permits untracked output but rejects dirty tracked files", () => {
  const repository = mkdtempSync(join(tmpdir(), "w3c-clean-head-"));
  try {
    const git = (...args) =>
      execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
    git("init", "--quiet");
    git("config", "user.email", "conformance@example.invalid");
    git("config", "user.name", "Conformance Test");
    writeFileSync(join(repository, "tracked"), "clean\n");
    git("add", "tracked");
    git("commit", "--quiet", "-m", "fixture");
    const head = assertCleanExactHead(repository);
    writeFileSync(join(repository, "untracked"), "allowed\n");
    assert.equal(assertCleanExactHead(repository), head);
    writeFileSync(join(repository, "tracked"), "dirty\n");
    assert.throws(() => assertCleanExactHead(repository), /tracked tree/u);
  } finally {
    rmSync(repository, { force: true, recursive: true });
  }
});

test("trusted output is fixed, symlink-safe, and atomically replaces only its target", () => {
  const outer = mkdtempSync(join(realpathSync(tmpdir()), "w3c-output-"));
  const repository = join(outer, "repository");
  const outside = join(outer, "outside");
  const target = join(repository, "test-results", "w3c-conformance");
  const sentinel = join(outside, "sentinel");
  try {
    mkdirSync(target, { recursive: true });
    mkdirSync(outside);
    writeFileSync(join(target, "old"), "old\n");
    writeFileSync(sentinel, "outside\n");
    assert.equal(
      validateConformanceOutputPath({ repositoryRoot: repository }),
      target,
    );
    const workspace = prepareConformanceOutputPath({
      repositoryRoot: repository,
      beforeQuarantineRename: ({ targetPath }) => {
        rmSync(targetPath, { recursive: true });
        symlinkSync(outside, targetPath);
      },
    });
    writeFileSync(join(workspace.outputPath, "result"), "new\n");
    workspace.publish();
    assert.equal(readFileSync(join(target, "result"), "utf8"), "new\n");
    assert.equal(readFileSync(sentinel, "utf8"), "outside\n");
    assert.deepEqual(
      readdirSync(join(repository, "test-results")).filter((name) =>
        name.startsWith(".w3c-"),
      ),
      [],
    );

    rmSync(target, { recursive: true });
    symlinkSync(outside, target);
    assert.throws(
      () => validateConformanceOutputPath({ repositoryRoot: repository }),
      /symlink component/u,
    );
    assert.equal(readFileSync(sentinel, "utf8"), "outside\n");
  } finally {
    rmSync(outer, { force: true, recursive: true });
  }
});

test("runtime hashing is deterministic, detects mutation, and rejects escaping symlinks", () => {
  const directory = mkdtempSync(join(tmpdir(), "w3c-runtime-hash-"));
  try {
    mkdirSync(join(directory, "package"));
    writeFileSync(join(directory, "package", "index.js"), "first\n");
    const first = hashDirectory(directory);
    assert.equal(hashDirectory(directory), first);
    writeFileSync(join(directory, "package", "index.js"), "second\n");
    assert.notEqual(hashDirectory(directory), first);
    symlinkSync("../../outside", join(directory, "package", "escape"));
    assert.throws(() => hashDirectory(directory), /symlink escapes/u);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("fresh temporary roots are unpredictable mode-0700 and removed in finally", async () => {
  let first;
  let second;
  await assert.rejects(
    withMode0700TemporaryDirectory(async (rootPath) => {
      first = rootPath;
      assert.equal(statSync(rootPath).mode & 0o777, 0o700);
      writeFileSync(join(rootPath, "sentinel"), "temporary\n");
      throw new Error("forced failure");
    }),
    /forced failure/u,
  );
  assert.equal(existsSync(first), false);
  await withMode0700TemporaryDirectory(async (rootPath) => {
    second = rootPath;
    assert.equal(statSync(rootPath).mode & 0o777, 0o700);
  });
  assert.notEqual(first, second);
  assert.equal(existsSync(second), false);
});

test("Linux sandbox contract drops identity, groups, and privilege before external execution", () => {
  const utilities = {
    env: "/usr/bin/env",
    setpriv: "/usr/bin/setpriv",
    sh: "/bin/sh",
    sudo: "/usr/bin/sudo",
    unshare: "/usr/bin/unshare",
  };
  const sandbox = buildLinuxSandboxCommand({
    args: ["external.js"],
    command: "/trusted/node",
    identity: { gid: 1001, uid: 1000 },
    environment: { HOME: "/temporary", TMPDIR: "/temporary" },
    privileged: true,
    utilities,
  });
  const setpriv = sandbox.args.indexOf(utilities.setpriv);
  const node = sandbox.args.indexOf("/trusted/node");
  assert.ok(setpriv >= 0 && setpriv < node);
  assert.deepEqual(sandbox.args.slice(setpriv + 1, setpriv + 8), [
    "--reuid",
    "1000",
    "--regid",
    "1001",
    "--clear-groups",
    "--no-new-privs",
    "--",
  ]);
  const guard = sandbox.args[sandbox.args.indexOf("-ceu") + 1];
  assert.match(guard, /\/proc\/self\/status/u);
  assert.match(guard, /supplementary groups/u);
  assert.match(guard, /no-new-privileges/u);
  assert.throws(
    () =>
      buildLinuxSandboxCommand({
        args: [],
        command: "/trusted/node",
        identity: { gid: 0, uid: 0 },
        privileged: true,
        utilities,
      }),
    /non-root original runner UID\/GID/u,
  );
});

test(
  "Linux sandbox adversarially denies network and writes outside raw results",
  { skip: process.platform !== "linux" },
  (context) => {
    const directory = mkdtempSync(join(tmpdir(), "w3c-linux-sandbox-"));
    const source = join(directory, "source");
    const output = join(directory, "raw-results");
    const outside = join(directory, "outside");
    try {
      mkdirSync(source);
      mkdirSync(output);
      mkdirSync(outside);
      const probe = join(source, "probe.mjs");
      const resultPath = join(output, "result.json");
      const outsidePath = join(outside, "forbidden");
      writeFileSync(
        probe,
        `import { appendFileSync, readFileSync, writeFileSync } from "node:fs";\nimport { connect } from "node:net";\nconst status = readFileSync("/proc/self/status", "utf8");\nconst field = (name) => status.split("\\n").find((line) => line.startsWith(name + ":"))?.slice(name.length + 1).trim() ?? "";\nconst deniedWrite = (path) => { try { appendFileSync(path, "denied\\n"); return false; } catch { return true; } };\nconst networkDenied = await new Promise((resolve) => { const socket = connect({ host: "1.1.1.1", port: 53 }); socket.setTimeout(1000); socket.once("connect", () => { socket.destroy(); resolve(false); }); socket.once("error", () => resolve(true)); socket.once("timeout", () => { socket.destroy(); resolve(true); }); });\nwriteFileSync(process.argv[3], JSON.stringify({ euid: process.geteuid(), groups: field("Groups"), noNewPrivs: field("NoNewPrivs"), networkDenied, sourceWriteDenied: deniedWrite(process.argv[2]), outsideWriteDenied: deniedWrite(process.argv[4]) }));\n`,
      );
      chmodSync(probe, 0o444);
      chmodSync(source, 0o555);
      let sandbox;
      try {
        sandbox = linuxNetworkSandboxCommand(process.execPath, [
          "--permission",
          `--allow-fs-read=${source}`,
          "--allow-fs-read=/proc/self/status",
          `--allow-fs-write=${output}`,
          probe,
          probe,
          resultPath,
          outsidePath,
        ]);
      } catch (error) {
        context.skip(`verified Linux sandbox unavailable: ${error.message}`);
        return;
      }
      const result = spawnSync(sandbox.command, sandbox.args, {
        encoding: "utf8",
        timeout: 15_000,
      });
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(readFileSync(resultPath, "utf8"));
      assert.notEqual(report.euid, 0);
      assert.equal(report.groups, "");
      assert.equal(report.noNewPrivs, "1");
      assert.equal(report.networkDenied, true);
      assert.equal(report.sourceWriteDenied, true);
      assert.equal(report.outsideWriteDenied, true);
    } finally {
      chmodSync(source, 0o755);
      rmSync(directory, { force: true, recursive: true });
    }
  },
);

test("acquisition is CI-only and approval-gated before network access", () => {
  const acquisition = new URL(
    "./acquire-w3c-did-test-suite.mjs",
    import.meta.url,
  );
  const outsideCi = { ...process.env };
  delete outsideCi.CI;
  delete outsideCi.W3C_SUITE_DERIVED_ARTIFACTS_APPROVED;
  const blockedOutside = spawnSync(process.execPath, [acquisition.pathname], {
    encoding: "utf8",
    env: outsideCi,
  });
  assert.equal(blockedOutside.status, 1);
  assert.match(blockedOutside.stderr, /CI-only/u);

  const noApproval = { ...process.env, CI: "true" };
  delete noApproval.W3C_SUITE_DERIVED_ARTIFACTS_APPROVED;
  const blockedApproval = spawnSync(process.execPath, [acquisition.pathname], {
    encoding: "utf8",
    env: noApproval,
  });
  assert.equal(blockedApproval.status, 1);
  assert.match(blockedApproval.stderr, /Maintainer\/legal approval/u);
});

test("checksum drift fails before extraction or execution and leaves no persistent acquisition state", () => {
  const directory = mkdtempSync(join(tmpdir(), "w3c-acquisition-drift-"));
  const archive = join(directory, "upstream.tar.gz");
  const acquisition = new URL(
    "./acquire-w3c-did-test-suite.mjs",
    import.meta.url,
  );
  writeFileSync(archive, "not the pinned archive\n");
  const before = new Set(
    readdirSync(realpathSync(tmpdir())).filter((name) =>
      name.startsWith("midnight-w3c-run-"),
    ),
  );
  try {
    const result = spawnSync(
      process.execPath,
      [acquisition.pathname, "--archive", archive],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          CI: "true",
          W3C_SUITE_DERIVED_ARTIFACTS_APPROVED: "true",
        },
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /archive checksum mismatch/u);
    const after = readdirSync(realpathSync(tmpdir())).filter(
      (name) => name.startsWith("midnight-w3c-run-") && !before.has(name),
    );
    assert.deepEqual(after, []);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("evidence file validator checks canonical fixture and raw-result bytes", () => {
  const directory = mkdtempSync(join(tmpdir(), "w3c-evidence-files-"));
  const evidencePath = join(directory, "evidence.json");
  const validator = new URL("./validate-w3c-evidence.mjs", import.meta.url);
  const baseline = loadAndValidateBaseline(baselineUrl, {
    packageJsonUrl: new URL("../../package.json", import.meta.url),
  });
  const evidence = createValidEvidence(baseline);
  try {
    const fixture = canonicalJson({ fixture: true });
    writeFileSync(join(directory, evidence.fixture.path), fixture);
    evidence.fixture.sha256 = sha256(fixture);
    for (const suite of evidence.suites) {
      const raw = canonicalJson({ name: suite.name });
      writeFileSync(join(directory, suite.rawOutput), raw);
      suite.rawOutputSha256 = sha256(raw);
    }
    writeFileSync(evidencePath, canonicalJson(evidence));
    const passed = spawnSync(
      process.execPath,
      [
        validator.pathname,
        "--evidence",
        evidencePath,
        "--artifacts-dir",
        directory,
      ],
      { encoding: "utf8" },
    );
    assert.equal(passed.status, 0, passed.stderr);
    writeFileSync(join(directory, evidence.suites[0].rawOutput), "drift\n");
    const failed = spawnSync(
      process.execPath,
      [
        validator.pathname,
        "--evidence",
        evidencePath,
        "--artifacts-dir",
        directory,
      ],
      { encoding: "utf8" },
    );
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /raw output checksum mismatch/u);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("CI has separate repository and approved fresh external lanes with exact-SHA upload only", () => {
  const ci = loadYaml(read(".github/workflows/ci.yml"));
  const ordinarySteps = ci.jobs["run-pipeline"].steps;
  assert.equal(
    ordinarySteps.some(({ run = "" }) => run.includes("conformance:external")),
    false,
  );
  const steps = ci.jobs["w3c-conformance"].steps;
  const repositoryStep = steps.find(
    ({ name }) => name === "Run mandatory repository-owned conformance gate",
  );
  const externalStep = steps.find(
    ({ name }) => name === "Run approved fresh external conformance lane",
  );
  const upload = steps.find(
    ({ name }) => name === "Upload exact-SHA external conformance evidence",
  );
  assert.ok(repositoryStep);
  assert.equal(externalStep.run, "pnpm test:conformance:external");
  assert.equal(
    externalStep.env.W3C_SUITE_DERIVED_ARTIFACTS_APPROVED,
    "${{ vars.W3C_SUITE_DERIVED_ARTIFACTS_APPROVED }}",
  );
  assert.equal(upload.if, "success()");
  assert.equal(upload.with.name, "w3c-conformance-${{ github.sha }}");
  assert.equal(upload.with.path, "test-results/w3c-conformance/**");
  assert.equal(upload.with["if-no-files-found"], "error");
});

test("external integration remains absent from release, signing, provenance, and publication files", () => {
  for (const path of [
    ".github/workflows/publish.yml",
    "scripts/release-sign-assets.sh",
    "scripts/release-build-provenance-subjects.sh",
    "scripts/publish-github-release-assets.sh",
  ]) {
    const source = read(path);
    assert.doesNotMatch(
      source,
      /W3C_SUITE_DERIVED|w3c-conformance-evidence|conformance:external/u,
      path,
    );
  }
  const acquisition = read(
    "scripts/conformance/acquire-w3c-did-test-suite.mjs",
  );
  assert.doesNotMatch(
    acquisition,
    /cacheRoot|markerPath|W3C_CONFORMANCE_CACHE_DIR/u,
  );
  assert.match(acquisition, /withMode0700TemporaryDirectory/u);
  assert.match(acquisition, /finally/u);
  const runner = read("scripts/conformance/run-w3c-did-test-suite.mjs");
  assert.doesNotMatch(runner, /allow-fs-read=\$\{repositoryRoot\}/u);
  assert.match(runner, /allow-fs-read=\$\{realRuntimeRoot\}/u);
  assert.match(runner, /allow-fs-write=\$\{realScratchRoot\}/u);
  const adapter = read("scripts/conformance/w3c-did-test-suite-adapter.cjs");
  assert.match(adapter, /rootDir: sourceRoot/u);
  assert.match(
    read("w3c-spec/conformance/README.md"),
    /immutable release evidence.*remain open/u,
  );
  assert.match(
    read("w3c-spec/conformance/registry.md"),
    /decision remains open/u,
  );
});

test("platform network-denial selection fails closed or returns the explicit platform sandbox", () => {
  if (process.platform === "darwin") {
    const sandbox = networkDeniedCommand(process.execPath, ["--version"]);
    assert.equal(sandbox.command, "/usr/bin/sandbox-exec");
    assert.equal(sandbox.kind, "macos-sandbox-exec-network-denied");
  } else if (process.platform !== "linux") {
    assert.throws(
      () => networkDeniedCommand(process.execPath, []),
      /No verified network-denial sandbox/u,
    );
  }
});
