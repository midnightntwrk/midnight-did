import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const fail = (message) => {
  throw new Error(`External conformance evidence invalid: ${message}`);
};

export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

const sortValue = (value) => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
};

export const canonicalJson = (value) =>
  `${JSON.stringify(sortValue(value), null, 2)}\n`;

export const hashDirectory = (root, { exclude = [] } = {}) => {
  const absoluteRoot = resolve(root);
  const excluded = exclude;
  const records = [];
  const walk = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const path = resolve(directory, name);
      const repositoryPath = relative(absoluteRoot, path).split(sep).join("/");
      if (
        excluded.some(
          (entry) =>
            repositoryPath === entry || repositoryPath.startsWith(`${entry}/`),
        )
      ) {
        continue;
      }
      const stat = lstatSync(path);
      if (stat.isDirectory()) {
        walk(path);
      } else if (stat.isSymbolicLink()) {
        const target = readlinkSync(path);
        const resolvedTarget = resolve(dirname(path), target);
        if (
          resolvedTarget !== absoluteRoot &&
          !resolvedTarget.startsWith(`${absoluteRoot}${sep}`)
        ) {
          fail(`runtime symlink escapes its verified root: ${repositoryPath}`);
        }
        records.push(`L ${repositoryPath} ${target}`);
      } else if (stat.isFile()) {
        records.push(`F ${repositoryPath} ${sha256(readFileSync(path))}`);
      } else {
        fail(`runtime contains unsupported file type: ${repositoryPath}`);
      }
    }
  };
  walk(absoluteRoot);
  return sha256(`${records.join("\n")}\n`);
};

const requireString = (value, path) => {
  if (typeof value !== "string" || value.length === 0)
    fail(`${path} must be a non-empty string`);
};

const requireSha256 = (value, path) => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    fail(`${path} must be a lowercase SHA-256 digest`);
  }
};

const requireStringArray = (value, path) => {
  if (!Array.isArray(value) || value.length === 0)
    fail(`${path} must be a non-empty array`);
  value.forEach((entry, index) => requireString(entry, `${path}[${index}]`));
  if (new Set(value).size !== value.length)
    fail(`${path} must not contain duplicates`);
};

export const assertSupportedNodeVersion = (version, requiredMajor) => {
  requireString(version, "Node version");
  if (!Number.isSafeInteger(requiredMajor) || requiredMajor < 1) {
    fail("required Node major must be a positive integer");
  }
  const major = Number(/^v(\d+)\.\d+\.\d+$/u.exec(version)?.[1]);
  if (major !== requiredMajor) {
    fail(`Node major ${requiredMajor} is required; got ${version}`);
  }
  return version;
};

export const loadAndValidateBaseline = (
  baselineUrl,
  { packageJsonUrl = new URL("../../package.json", import.meta.url) } = {},
) => {
  const baseline = JSON.parse(readFileSync(baselineUrl, "utf8"));
  const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8"));

  requireString(baseline.schemaVersion, "schemaVersion");
  requireString(baseline.claim, "claim");
  if (baseline.toolchains?.nodeMajor !== 24) {
    fail("toolchains.nodeMajor must remain 24");
  }
  requireString(baseline.toolchains?.npm, "toolchains.npm");
  requireString(baseline.toolchains?.pnpm, "toolchains.pnpm");
  requireString(baseline.toolchains?.compact, "toolchains.compact");
  const packageManager = packageJson.packageManager;
  requireString(packageManager, "package.json packageManager");
  const expectedPnpm = packageManager.match(/^pnpm@(.+)$/u)?.[1];
  if (expectedPnpm !== baseline.toolchains.pnpm) {
    fail(
      `toolchains.pnpm ${baseline.toolchains.pnpm} does not match package.json authority ${packageManager}`,
    );
  }

  if (!Array.isArray(baseline.standards) || baseline.standards.length !== 3) {
    fail("standards must contain the three audited baselines");
  }
  baseline.standards.forEach((standard, index) => {
    requireString(standard.name, `standards[${index}].name`);
    requireString(standard.url, `standards[${index}].url`);
    requireSha256(standard.sha256, `standards[${index}].sha256`);
    if (!new Set(["PASS", "FAIL"]).has(standard.status)) {
      fail(`standards[${index}].status must be PASS or FAIL`);
    }
  });

  requireString(baseline.upstream?.repository, "upstream.repository");
  if (!/^[0-9a-f]{40}$/u.test(baseline.upstream?.commit ?? "")) {
    fail("upstream.commit must be a full commit SHA");
  }
  requireString(baseline.upstream.archiveUrl, "upstream.archiveUrl");
  requireSha256(baseline.upstream.archiveSha256, "upstream.archiveSha256");
  requireSha256(
    baseline.upstream.extractedTreeSha256,
    "upstream.extractedTreeSha256",
  );
  for (const [path, digest] of Object.entries(
    baseline.upstream.lockfiles ?? {},
  )) {
    requireString(path, "upstream.lockfiles path");
    requireSha256(digest, `upstream.lockfiles.${path}`);
  }
  if (Object.keys(baseline.upstream.lockfiles ?? {}).length !== 3) {
    fail("upstream.lockfiles must pin all three lockfiles");
  }
  for (const [path, digest] of Object.entries(
    baseline.upstream.verifiedFiles ?? {},
  )) {
    requireString(path, "upstream.verifiedFiles path");
    requireSha256(digest, `upstream.verifiedFiles.${path}`);
  }
  if (baseline.upstream.license?.status !== "mixed-or-unclear") {
    fail("upstream license ambiguity must remain explicit");
  }
  if (
    baseline.upstream.license.approvalStatus !== "approved" ||
    baseline.upstream.license.approvalRecord !==
      "https://github.com/midnightntwrk/midnight-did/issues/446#issuecomment-5569537724"
  ) {
    fail(
      "suite-derived artifact approval must remain bound to its public record",
    );
  }
  requireString(
    baseline.upstream.license.approvedScope,
    "upstream.license.approvedScope",
  );
  requireString(
    baseline.upstream.license.excludedScope,
    "upstream.license.excludedScope",
  );
  if (
    !sameJson(baseline.upstream.runtime?.installedLockfiles, [
      "packages/did-core-test-server/package-lock.json",
      "packages/jest-did-matcher/package-lock.json",
    ]) ||
    baseline.upstream.runtime?.rootLockfileDisposition !==
      "verified-but-not-installed-because-the-adapter-needs-only-the-two-child-runtimes"
  ) {
    fail(
      "dependency installation must remain bound to the verified child lockfiles",
    );
  }
  if (
    baseline.upstream.runtime?.requiredNodeMajor !==
      baseline.toolchains.nodeMajor ||
    baseline.upstream.runtime?.platform !== "linux-only" ||
    baseline.upstream.runtime?.lifecycleScripts !== "disabled" ||
    baseline.upstream.runtime?.networkDuringExecution !== "denied" ||
    baseline.upstream.runtime?.executionEnvironment !==
      "allowlisted-no-ci-credentials" ||
    baseline.upstream.runtime?.sourceDuringExecution !== "read-only" ||
    baseline.upstream.runtime?.snapshotRetention !==
      "ephemeral-temporary-directory-removed-after-execution"
  ) {
    fail("upstream runtime safety policy drift");
  }
  requireStringArray(
    baseline.upstream.runtime.sourceAllowlist,
    "upstream.runtime.sourceAllowlist",
  );
  requireSha256(
    baseline.upstream.runtime.allowlistedSourceSha256,
    "upstream.runtime.allowlistedSourceSha256",
  );
  requireSha256(
    baseline.upstream.runtime.matcherSourceSha256,
    "upstream.runtime.matcherSourceSha256",
  );
  for (const field of [
    "maxArchiveBytes",
    "maxOldSpaceMiB",
    "timeoutSeconds",
    "maxCapturedOutputBytes",
  ]) {
    if (
      !Number.isSafeInteger(
        baseline.upstream.runtime?.resourceLimits?.[field],
      ) ||
      baseline.upstream.runtime.resourceLimits[field] < 1
    ) {
      fail(
        `upstream.runtime.resourceLimits.${field} must be a positive integer`,
      );
    }
  }

  requireStringArray(baseline.selectedSuites, "selectedSuites");
  for (const suite of baseline.selectedSuites) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(suite)) {
      fail(`selected suite is not a safe filename: ${suite}`);
    }
  }
  for (const [suite, label] of Object.entries(baseline.suiteLabels ?? {})) {
    if (!baseline.selectedSuites.includes(suite)) {
      fail(`suiteLabels contains unselected suite ${suite}`);
    }
    requireString(label, `suiteLabels.${suite}`);
  }
  if (
    !sameJson(
      Object.keys(baseline.expectedAssertions ?? {}).sort(),
      [...baseline.selectedSuites].sort(),
    )
  ) {
    fail("expectedAssertions must cover exactly the selected suites");
  }
  for (const [suite, count] of Object.entries(baseline.expectedAssertions)) {
    if (!Number.isSafeInteger(count) || count < 1) {
      fail(`expectedAssertions.${suite} must be a positive integer`);
    }
  }
  requireStringArray(baseline.excludedSuites, "excludedSuites");
  requireStringArray(baseline.limitations, "limitations");
  if (baseline.registry?.status !== "decision-pending-ownership-confirmation") {
    fail("registry status must remain an explicitly open human decision");
  }
  requireString(baseline.registry.openDecision, "registry.openDecision");
  if (
    baseline.registry.humanConfirmationRequired !== true ||
    baseline.registry.duplicateRegistrationAllowed !== false
  ) {
    fail(
      "registry update must require human confirmation and forbid duplicates",
    );
  }

  return baseline;
};

export const assertCleanExactHead = (repositoryRoot) => {
  const git = (...args) =>
    execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
  const changes = git("status", "--porcelain=v1", "--untracked-files=no");
  if (changes) fail("tracked tree must be clean");
  const head = git("rev-parse", "HEAD");
  if (!/^[0-9a-f]{40}$/u.test(head))
    fail("git HEAD must be an exact full commit SHA");
  return head;
};

const sameJson = (left, right) => canonicalJson(left) === canonicalJson(right);

const countFields = ["failed", "passed", "pending", "skipped", "todo", "total"];
const validateTotals = (totals, path) => {
  for (const field of countFields) {
    if (!Number.isSafeInteger(totals?.[field]) || totals[field] < 0) {
      fail(`${path}.${field} must be a non-negative integer`);
    }
  }
  const sum =
    totals.failed +
    totals.passed +
    totals.pending +
    totals.skipped +
    totals.todo;
  if (sum !== totals.total)
    fail(`${path}.total does not equal its status counts`);
  for (const field of ["failed", "pending", "skipped", "todo"]) {
    if (totals[field] !== 0)
      fail(`${path}.${field} must be zero, got ${totals[field]}`);
  }
  if (totals.passed === 0) fail(`${path}.passed must be non-zero`);
};

export const validateEvidence = (evidence, baseline) => {
  if (evidence?.schemaVersion !== "1.0.0")
    fail("unsupported evidence schemaVersion");
  if (evidence.claim !== baseline.claim) fail("evidence claim drift");
  if (
    !/^[0-9a-f]{40}$/u.test(evidence.repository?.commit ?? "") ||
    evidence.repository.clean !== true
  ) {
    fail("repository identity must contain an exact clean commit");
  }
  for (const name of ["root", "did", "contract"])
    requireString(evidence.packages?.[name], `packages.${name}`);
  for (const name of ["node", "npm", "pnpm", "nix", "compact"])
    requireString(evidence.toolchains?.[name], `toolchains.${name}`);
  assertSupportedNodeVersion(
    evidence.toolchains.node,
    baseline.toolchains.nodeMajor,
  );
  if (
    evidence.toolchains.npm !== baseline.toolchains.npm ||
    evidence.toolchains.pnpm !== baseline.toolchains.pnpm
  ) {
    fail("runtime package-manager toolchain does not match the baseline");
  }
  if (!sameJson(evidence.standards, baseline.standards))
    fail("standards identity drift");
  if (!sameJson(evidence.upstream, baseline.upstream))
    fail("upstream identity drift");
  if (!sameJson(evidence.selectedSuites, baseline.selectedSuites))
    fail("selected suites drift");
  if (!sameJson(evidence.suiteLabels, baseline.suiteLabels))
    fail("suite labels drift");
  if (!sameJson(evidence.expectedAssertions, baseline.expectedAssertions))
    fail("expected assertion counts drift");
  if (!sameJson(evidence.excludedSuites, baseline.excludedSuites))
    fail("excluded suites drift");
  if (!sameJson(evidence.limitations, baseline.limitations))
    fail("limitations drift");
  if (!sameJson(evidence.registry, baseline.registry))
    fail("registry posture drift");
  if (
    evidence.upstreamRuntime?.commit !== baseline.upstream.commit ||
    evidence.upstreamRuntime?.archiveSha256 !==
      baseline.upstream.archiveSha256 ||
    evidence.upstreamRuntime?.lifecycleScripts !== "disabled" ||
    evidence.upstreamRuntime?.sandboxPrivilegePolicy !==
      "drop-before-external-exec-v1" ||
    evidence.upstreamRuntime?.platform !== "linux" ||
    !sameJson(
      evidence.upstreamRuntime?.installedLockfiles,
      baseline.upstream.runtime.installedLockfiles,
    )
  ) {
    fail("upstream runtime identity drift");
  }
  requireString(evidence.upstreamRuntime?.node, "upstreamRuntime.node");
  requireString(evidence.upstreamRuntime?.npm, "upstreamRuntime.npm");
  assertSupportedNodeVersion(
    evidence.upstreamRuntime.node,
    baseline.toolchains.nodeMajor,
  );
  if (
    evidence.upstreamRuntime.node !== evidence.toolchains.node ||
    evidence.upstreamRuntime.npm !== baseline.toolchains.npm
  ) {
    fail("upstreamRuntime exact Node/npm toolchain drift");
  }
  requireSha256(
    evidence.upstreamRuntime?.packageInventorySha256,
    "upstreamRuntime.packageInventorySha256",
  );
  requireSha256(
    evidence.upstreamRuntime?.runtimeSha256,
    "upstreamRuntime.runtimeSha256",
  );
  requireSha256(
    evidence.upstreamRuntime?.matcherSourceSha256,
    "upstreamRuntime.matcherSourceSha256",
  );
  requireSha256(
    evidence.upstreamRuntime?.sourceSha256,
    "upstreamRuntime.sourceSha256",
  );
  if (
    evidence.upstreamRuntime.ephemeral !== true ||
    evidence.upstreamRuntime.temporaryRootMode !== "0700" ||
    !sameJson(
      evidence.upstreamRuntime.sourceAllowlist,
      baseline.upstream.runtime.sourceAllowlist,
    ) ||
    evidence.upstreamRuntime.sourceSha256 !==
      baseline.upstream.runtime.allowlistedSourceSha256 ||
    evidence.upstreamRuntime.matcherSourceSha256 !==
      baseline.upstream.runtime.matcherSourceSha256
  ) {
    fail("ephemeral runtime or source allowlist identity drift");
  }
  requireSha256(
    evidence.upstreamRuntime?.sandboxSha256,
    "upstreamRuntime.sandboxSha256",
  );
  if (
    evidence.upstreamRuntime.sandboxSha256 !== evidence.adapter?.sandboxSha256
  ) {
    fail("acquisition and execution sandbox identity drift");
  }
  if (
    !Number.isSafeInteger(evidence.upstreamRuntime?.packageCount) ||
    evidence.upstreamRuntime.packageCount < 1
  ) {
    fail("upstreamRuntime.packageCount must be a positive integer");
  }
  requireString(evidence.adapter?.version, "adapter.version");
  for (const field of [
    "acquisitionSha256",
    "generatorSha256",
    "librarySha256",
    "runnerSha256",
    "sandboxSha256",
    "setupSha256",
    "sha256",
    "validatorSha256",
  ]) {
    requireSha256(evidence.adapter?.[field], `adapter.${field}`);
  }
  requireString(evidence.adapter?.sandbox, "adapter.sandbox");
  if (
    !sameJson(
      evidence.adapter?.resourceLimits,
      baseline.upstream.runtime.resourceLimits,
    )
  ) {
    fail("adapter resource limits drift");
  }
  requireSha256(evidence.fixture?.sha256, "fixture.sha256");
  if (
    evidence.fixture?.data === null ||
    typeof evidence.fixture?.data !== "object" ||
    Array.isArray(evidence.fixture.data)
  ) {
    fail("fixture.data must be an object");
  }
  if (
    sha256(canonicalJson(evidence.fixture.data)) !== evidence.fixture.sha256
  ) {
    fail("fixture data checksum mismatch");
  }
  if ("path" in evidence.fixture) {
    fail("fixture must not reference a supplementary output artifact");
  }

  const actualSuites = evidence.suites?.map(({ name }) => name) ?? [];
  if (!sameJson(actualSuites, baseline.selectedSuites))
    fail("results do not contain exactly the selected suites");
  for (const [index, suite] of evidence.suites.entries()) {
    validateTotals(suite.totals, `suites[${index}].totals`);
    if (suite.totals.total !== baseline.expectedAssertions[suite.name]) {
      fail(
        `suite ${suite.name} returned ${suite.totals.total} assertions, expected ${baseline.expectedAssertions[suite.name]}`,
      );
    }
    requireSha256(suite.rawOutputSha256, `suites[${index}].rawOutputSha256`);
    if ("rawOutput" in suite) {
      fail(
        `suites[${index}] must not reference a supplementary output artifact`,
      );
    }
    const { rawOutputSha256, ...normalizedSuite } = suite;
    if (sha256(canonicalJson(normalizedSuite)) !== rawOutputSha256) {
      fail(`suites[${index}] normalized result checksum mismatch`);
    }
    if (
      !Array.isArray(suite.assertions) ||
      suite.assertions.length !== suite.totals.total
    ) {
      fail(`suites[${index}] assertions are missing or inconsistent`);
    }
    for (const assertion of suite.assertions) {
      if (assertion.status !== "passed")
        fail(`suite ${suite.name} contains non-passing assertion status`);
      requireString(assertion.title, `suite ${suite.name} assertion title`);
      if (!Array.isArray(assertion.ancestors))
        fail(`suite ${suite.name} assertion ancestors must be an array`);
      assertion.ancestors.forEach((ancestor, ancestorIndex) =>
        requireString(
          ancestor,
          `suite ${suite.name} assertion ancestors[${ancestorIndex}]`,
        ),
      );
    }
  }
  validateTotals(evidence.totals, "totals");
  const sum = evidence.suites.reduce(
    (totals, suite) => {
      for (const field of countFields) totals[field] += suite.totals[field];
      return totals;
    },
    Object.fromEntries(countFields.map((field) => [field, 0])),
  );
  if (!sameJson(sum, evidence.totals))
    fail("aggregate totals do not equal per-suite totals");
  return evidence;
};
