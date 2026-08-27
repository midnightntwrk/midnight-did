import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const git = (...args) =>
  execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
const trackedChanges = () =>
  git("status", "--porcelain=v1", "--untracked-files=no");
const failForDirtyTree = (phase) => {
  if (!trackedChanges()) return false;
  console.error(
    `Conformance evidence aborted: tracked staged or unstaged files are dirty ${phase}. Commit or restore tracked changes; untracked files are ignored.`,
  );
  return true;
};

if (failForDirtyTree("before the conformance lane")) process.exit(1);
const initialHead = git("rev-parse", "HEAD");

const commands = [
  [process.execPath, ["scripts/conformance-banner.mjs"]],
  ["pnpm", ["--filter", "./packages/contract", "build:prepared"]],
  [
    "pnpm",
    [
      "--filter",
      "./packages/domain",
      "test:ci",
      "src/test/midnight-did-syntax.conformance.test.ts",
    ],
  ],
  [
    "pnpm",
    [
      "--filter",
      "./packages/did",
      "test:ci",
      "src/test/midnight-did-jsonld-conformance.test.ts",
      "src/test/midnight-did-resolver.test.ts",
    ],
  ],
];

let commandFailed = false;
for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(
      `Conformance command failed to start: ${result.error.message}`,
    );
    commandFailed = true;
    break;
  }
  if (result.status !== 0) {
    commandFailed = true;
    break;
  }
}

const finalHead = git("rev-parse", "HEAD");
const headChanged = finalHead !== initialHead;
if (headChanged) {
  console.error(
    `Conformance evidence aborted: git HEAD changed during the conformance lane (${initialHead} -> ${finalHead}).`,
  );
}
const treeDirty = failForDirtyTree("during the conformance lane");

if (commandFailed || headChanged || treeDirty) process.exit(1);
console.log(
  `Conformance evidence completed at unchanged clean HEAD ${initialHead}.`,
);
