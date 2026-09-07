#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { withFreshW3cRuntime } from "./acquire-w3c-did-test-suite.mjs";
import {
  prepareConformanceOutputPath,
  validateConformanceOutputPath,
} from "./destructive-output-path.mjs";
import {
  assertCleanExactHead,
  canonicalJson,
  loadAndValidateBaseline,
  sha256,
  validateEvidence,
} from "./external-conformance-lib.mjs";
import { networkDeniedCommand } from "./network-sandbox.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const baseline = loadAndValidateBaseline(
  new URL("../../w3c-spec/conformance/external-suites.json", import.meta.url),
);
const finalOutputRoot = validateConformanceOutputPath({ repositoryRoot });
const adapterPath = resolve(
  repositoryRoot,
  "scripts/conformance/w3c-did-test-suite-adapter.cjs",
);
const setupPath = resolve(
  repositoryRoot,
  "scripts/conformance/w3c-suite-setup.cjs",
);
const generatorPath = resolve(
  repositoryRoot,
  "packages/did/scripts/generate-w3c-fixture.mjs",
);
const libraryPath = resolve(
  repositoryRoot,
  "scripts/conformance/external-conformance-lib.mjs",
);
const validatorPath = resolve(
  repositoryRoot,
  "scripts/conformance/validate-w3c-evidence.mjs",
);
const acquisitionScriptPath = resolve(
  repositoryRoot,
  "scripts/conformance/acquire-w3c-did-test-suite.mjs",
);
const runnerPath = fileURLToPath(import.meta.url);
const networkSandboxPath = resolve(
  repositoryRoot,
  "scripts/conformance/network-sandbox.mjs",
);

const argument = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  if (index + 1 >= process.argv.length)
    throw new Error(`${name} requires a value`);
  return process.argv[index + 1];
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    maxBuffer: baseline.upstream.runtime.resourceLimits.maxCapturedOutputBytes,
    stdio: options.capture ? "pipe" : "inherit",
    timeout: options.timeout ?? 180_000,
    env: options.env ?? process.env,
  });
  if (result.error) throw result.error;
  if (result.signal)
    throw new Error(
      `${command} exceeded its resource/time limit (${result.signal})`,
    );
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr}` : "";
    throw new Error(
      `${command} ${args.join(" ")} failed with status ${result.status}${detail}`,
    );
  }
  return result.stdout?.trim() ?? "";
};

const commandVersion = (command, args, unavailable) => {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim();
  } catch {
    return unavailable;
  }
};

const packageIdentity = (path) => {
  const packageJson = JSON.parse(
    readFileSync(resolve(repositoryRoot, path), "utf8"),
  );
  return `${packageJson.name}@${packageJson.version}`;
};

const totals = (suites) =>
  suites.reduce(
    (all, suite) => {
      for (const field of [
        "failed",
        "passed",
        "pending",
        "skipped",
        "todo",
        "total",
      ]) {
        all[field] += suite.totals[field];
      }
      return all;
    },
    { failed: 0, passed: 0, pending: 0, skipped: 0, todo: 0, total: 0 },
  );

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const html = (evidence) => `<!doctype html>
<meta charset="utf-8">
<title>Midnight DID supplemental W3C suite evidence</title>
<h1>Midnight DID supplemental W3C suite evidence</h1>
<p>Not W3C certification or endorsement. Canonical evidence: <code>w3c-conformance-evidence.json</code>.</p>
<p>Repository commit: <code>${escapeHtml(evidence.repository.commit)}</code></p>
<table><thead><tr><th>Suite</th><th>Passed</th><th>Failed</th><th>Pending/skipped/todo</th></tr></thead><tbody>
${evidence.suites.map((suite) => `<tr><td>${escapeHtml(suite.name)}</td><td>${suite.totals.passed}</td><td>${suite.totals.failed}</td><td>${suite.totals.pending + suite.totals.skipped + suite.totals.todo}</td></tr>`).join("\n")}
</tbody></table>
`;

if (process.env.CI !== "true") {
  throw new Error(
    "The external W3C harness is CI-only; refusing execution outside CI",
  );
}
if (process.env.W3C_SUITE_DERIVED_ARTIFACTS_APPROVED !== "true") {
  throw new Error(
    "Maintainer/legal approval is required before executing the adapted upstream runtime",
  );
}
const initialHead = assertCleanExactHead(repositoryRoot);
if (
  process.env.GITHUB_SHA !== undefined &&
  process.env.GITHUB_SHA !== initialHead
) {
  throw new Error(
    `GITHUB_SHA ${process.env.GITHUB_SHA} does not match checked-out HEAD ${initialHead}`,
  );
}
if (process.version !== `v${baseline.toolchains.node}`) {
  throw new Error(
    `Exact Node ${baseline.toolchains.node} is mandatory; got ${process.version}`,
  );
}
const npm = run("npm", ["--version"], { capture: true });
if (npm !== baseline.toolchains.npm) {
  throw new Error(
    `npm ${npm} does not match exact baseline ${baseline.toolchains.npm}`,
  );
}
const pnpm = run("pnpm", ["--version"], { capture: true });
if (pnpm !== baseline.toolchains.pnpm) {
  throw new Error(
    `pnpm ${pnpm} does not match package.json authority ${baseline.toolchains.pnpm}`,
  );
}
const compact = commandVersion(
  "compact",
  ["compile", "--version"],
  "unavailable",
);
if (compact !== baseline.toolchains.compact) {
  throw new Error(
    `Compact compiler ${compact} does not match baseline ${baseline.toolchains.compact}`,
  );
}

let outputWorkspace = prepareConformanceOutputPath({ repositoryRoot });
process.once("exit", () => outputWorkspace?.cleanup());
const outputRoot = outputWorkspace.outputPath;
run("pnpm", ["--filter", "./packages/contract", "build:prepared"]);
run("pnpm", ["--filter", "./packages/did", "build"]);
const fixturePath = join(outputRoot, "midnight-did-core-1.0-fixture.json");
run(process.execPath, [generatorPath, "--output", fixturePath]);

const execution = await withFreshW3cRuntime(
  {
    archiveInput: argument("--archive"),
    trustedFiles: {
      "adapter.cjs": adapterPath,
      "fixture.json": fixturePath,
      "setup.cjs": setupPath,
    },
  },
  async ({ acquisition, runtimeRoot, scratchRoot, trustedFileHashes }) => {
    const rawResultsPath = join(scratchRoot, "results.json");
    const browserslistConfig = join(scratchRoot, "browserslist");
    const browserslistStats = join(scratchRoot, "browserslist-stats.json");
    writeFileSync(browserslistConfig, "defaults\n", {
      flag: "wx",
      mode: 0o600,
    });
    writeFileSync(browserslistStats, "{}\n", { flag: "wx", mode: 0o600 });
    const realRuntimeRoot = realpathSync(runtimeRoot);
    const realScratchRoot = realpathSync(scratchRoot);
    const runtimeTrustedRoot = join(realRuntimeRoot, "trusted");
    const externalEnvironment = {
      BROWSERSLIST_CONFIG: browserslistConfig,
      BROWSERSLIST_STATS: browserslistStats,
      HOME: realScratchRoot,
      LANG: "C.UTF-8",
      TMPDIR: realScratchRoot,
      W3C_RAW_RESULTS: rawResultsPath,
      W3C_SELECTED_SUITES: JSON.stringify(baseline.selectedSuites),
      W3C_SUITE_FIXTURE: join(runtimeTrustedRoot, "fixture.json"),
      W3C_SUITE_SETUP: join(runtimeTrustedRoot, "setup.cjs"),
      W3C_SUITE_SOURCE: realRuntimeRoot,
    };
    const sandbox = networkDeniedCommand(
      process.execPath,
      [
        `--max-old-space-size=${baseline.upstream.runtime.resourceLimits.maxOldSpaceMiB}`,
        "--permission",
        `--allow-fs-read=${realRuntimeRoot}`,
        `--allow-fs-read=${realScratchRoot}`,
        `--allow-fs-write=${realScratchRoot}`,
        join(runtimeTrustedRoot, "adapter.cjs"),
      ],
      { environment: externalEnvironment },
    );
    run(sandbox.command, sandbox.args, {
      cwd: join(realRuntimeRoot, "server"),
      env: {},
      timeout: baseline.upstream.runtime.resourceLimits.timeoutSeconds * 1_000,
    });
    const stat = statSync(rawResultsPath);
    if (
      !stat.isFile() ||
      stat.size >
        baseline.upstream.runtime.resourceLimits.maxCapturedOutputBytes
    ) {
      throw new Error(
        "External raw result is missing, unsupported, or exceeds its size limit",
      );
    }
    return {
      acquisition,
      parsedSuites: JSON.parse(readFileSync(rawResultsPath, "utf8")),
      sandboxKind: sandbox.kind,
      trustedFileHashes,
    };
  },
);

const suites = execution.parsedSuites.map((suite) => {
  if (!baseline.selectedSuites.includes(suite.name))
    throw new Error(`Unexpected suite result: ${suite.name}`);
  const rawPath = join(outputRoot, `${suite.name}.json`);
  const raw = canonicalJson(suite);
  writeFileSync(rawPath, raw, { flag: "wx", mode: 0o600 });
  return {
    ...suite,
    rawOutput: basename(rawPath),
    rawOutputSha256: sha256(raw),
  };
});
const fixture = readFileSync(fixturePath);
const evidence = {
  adapter: {
    acquisitionSha256: sha256(readFileSync(acquisitionScriptPath)),
    generatorSha256: sha256(readFileSync(generatorPath)),
    librarySha256: sha256(readFileSync(libraryPath)),
    resourceLimits: baseline.upstream.runtime.resourceLimits,
    runnerSha256: sha256(readFileSync(runnerPath)),
    sandbox: execution.sandboxKind,
    sandboxSha256: sha256(readFileSync(networkSandboxPath)),
    setupSha256: execution.trustedFileHashes["setup.cjs"],
    sha256: execution.trustedFileHashes["adapter.cjs"],
    validatorSha256: sha256(readFileSync(validatorPath)),
    version: "1.0.0",
  },
  claim: baseline.claim,
  excludedSuites: baseline.excludedSuites,
  expectedAssertions: baseline.expectedAssertions,
  fixture: {
    path: relative(outputRoot, fixturePath),
    sha256: execution.trustedFileHashes["fixture.json"],
  },
  limitations: baseline.limitations,
  packages: {
    contract: packageIdentity("packages/contract/package.json"),
    did: packageIdentity("packages/did/package.json"),
    root: packageIdentity("package.json"),
  },
  registry: baseline.registry,
  repository: { clean: true, commit: initialHead },
  schemaVersion: "1.0.0",
  selectedSuites: baseline.selectedSuites,
  standards: baseline.standards,
  suiteLabels: baseline.suiteLabels,
  suites,
  toolchains: {
    compact,
    nix: commandVersion(
      "nix",
      ["--version"],
      "not-installed (not used by this execution)",
    ),
    node: process.version,
    npm,
    pnpm,
  },
  totals: totals(suites),
  upstream: baseline.upstream,
  upstreamRuntime: execution.acquisition,
};
validateEvidence(evidence, baseline);
const evidencePath = join(outputRoot, "w3c-conformance-evidence.json");
const evidenceJson = canonicalJson(evidence);
writeFileSync(evidencePath, evidenceJson, { flag: "wx", mode: 0o600 });
writeFileSync(
  join(outputRoot, "w3c-conformance-evidence.json.sha256"),
  `${sha256(evidenceJson)}  ${basename(evidencePath)}\n`,
  { flag: "wx", mode: 0o600 },
);
writeFileSync(join(outputRoot, "report.html"), html(evidence), {
  flag: "wx",
  mode: 0o600,
});

for (const suite of evidence.suites) {
  if (
    sha256(readFileSync(join(outputRoot, suite.rawOutput))) !==
    suite.rawOutputSha256
  ) {
    throw new Error(`Trusted raw-output validation failed: ${suite.name}`);
  }
}
if (sha256(fixture) !== evidence.fixture.sha256)
  throw new Error("Trusted fixture validation failed");
const finalHead = assertCleanExactHead(repositoryRoot);
if (finalHead !== initialHead) {
  throw new Error(
    `git HEAD changed during external conformance (${initialHead} -> ${finalHead})`,
  );
}
outputWorkspace.publish();
outputWorkspace = undefined;
console.log(
  `External W3C fixture evidence passed ${evidence.totals.passed} assertions at ${initialHead}.`,
);
console.log(join(finalOutputRoot, basename(evidencePath)));
