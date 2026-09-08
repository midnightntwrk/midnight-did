import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const readPackage = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const git = (...args) =>
  execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
const assertCleanTrackedTree = () => {
  const trackedChanges = git(
    "status",
    "--porcelain=v1",
    "--untracked-files=no",
  );
  if (trackedChanges) {
    console.error(
      "Conformance evidence aborted: tracked staged or unstaged files are dirty. Commit or restore tracked changes before running this command; untracked files are ignored.",
    );
    process.exit(1);
  }
};
const optionalVersion = (command, args, fallback) => {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
};

assertCleanTrackedTree();
const initialGitHead = git("rev-parse", "HEAD");
const rootPackage = readPackage("../package.json");
const contractPackage = readPackage("../packages/contract/package.json");
const baseline = readPackage("../w3c-spec/conformance/external-suites.json");
const pnpmVersion =
  process.env.npm_config_user_agent?.match(/\bpnpm\/([^\s]+)/)?.[1] ??
  execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim();
const requiredPnpm = rootPackage.packageManager?.match(/^pnpm@(.+)$/u)?.[1];
if (
  !requiredPnpm ||
  pnpmVersion !== requiredPnpm ||
  baseline.toolchains.pnpm !== requiredPnpm
) {
  console.error(
    `Conformance evidence aborted: pnpm ${pnpmVersion} does not match package.json authority ${rootPackage.packageManager}.`,
  );
  process.exit(1);
}
const compactVersion = optionalVersion(
  "compact",
  ["compile", "--version"],
  "not-installed",
);
const nixVersion = optionalVersion(
  "nix",
  ["--version"],
  "not-installed (not used by this execution)",
);
const gitHead = git("rev-parse", "HEAD");
assertCleanTrackedTree();
if (gitHead !== initialGitHead) {
  console.error(
    "Conformance evidence aborted: git HEAD changed while collecting runtime versions. Run the command again on a stable clean revision.",
  );
  process.exit(1);
}

console.log("Conformance evidence runtime");
console.log(`  clean git HEAD: ${gitHead}`);
console.log(`  package: ${rootPackage.name}@${rootPackage.version}`);
console.log(`  contract: ${contractPackage.name}@${contractPackage.version}`);
console.log(`  Node: ${process.version}`);
console.log(`  pnpm: ${pnpmVersion}`);
console.log(`  Nix: ${nixVersion}`);
console.log(`  Compact compiler: ${compactVersion}`);
console.log("  pinned standards:");
for (const { name, url, sha256 } of baseline.standards) {
  console.log(`    - ${name}: ${url} (sha256:${sha256})`);
}
