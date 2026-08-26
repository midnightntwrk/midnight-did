import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";
import { test } from "node:test";

const bannerSource = new URL("./conformance-banner.mjs", import.meta.url);
const runnerSource = new URL("./run-conformance.mjs", import.meta.url);
const runGit = (root, ...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const fakePnpm = `#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

appendFileSync("pnpm-invocations.log", process.argv.slice(2).join(" ") + "\\n");
if (["dirty", "staged"].includes(process.env.CONFORMANCE_FIXTURE_MUTATION)) {
  appendFileSync("tracked.txt", "dirty\\n");
  if (process.env.CONFORMANCE_FIXTURE_MUTATION === "staged") {
    spawnSync("git", ["add", "tracked.txt"], { stdio: "inherit" });
  }
}
if (
  process.env.CONFORMANCE_FIXTURE_MUTATION === "head" &&
  readFileSync("tracked.txt", "utf8") === "initial\\n"
) {
  writeFileSync("tracked.txt", "committed during lane\\n");
  spawnSync("git", ["add", "tracked.txt"], { stdio: "inherit" });
  const commit = spawnSync(
    "git",
    ["-c", "commit.gpgSign=false", "commit", "--quiet", "-m", "lane mutation"],
    { stdio: "inherit" },
  );
  process.exitCode = commit.status ?? 1;
}
`;

const createFixture = async () => {
  const root = await mkdtemp(resolve(tmpdir(), "run-conformance-"));
  await mkdir(resolve(root, "scripts"));
  await mkdir(resolve(root, "packages", "contract"), { recursive: true });
  await mkdir(resolve(root, "bin"));
  await copyFile(
    bannerSource,
    resolve(root, "scripts", "conformance-banner.mjs"),
  );
  await copyFile(runnerSource, resolve(root, "scripts", "run-conformance.mjs"));
  await writeFile(
    resolve(root, "package.json"),
    `${JSON.stringify({ name: "fixture-root", type: "module", version: "1.2.3" }, null, 2)}\n`,
  );
  await writeFile(
    resolve(root, "packages", "contract", "package.json"),
    `${JSON.stringify({ name: "fixture-contract", version: "4.5.6" }, null, 2)}\n`,
  );
  await writeFile(resolve(root, "tracked.txt"), "initial\n");
  const pnpmPath = resolve(root, "bin", "pnpm");
  await writeFile(pnpmPath, fakePnpm);
  await chmod(pnpmPath, 0o755);
  runGit(root, "init", "--quiet");
  runGit(root, "config", "user.name", "Conformance Test");
  runGit(root, "config", "user.email", "conformance@example.test");
  runGit(root, "add", ".");
  runGit(
    root,
    "-c",
    "commit.gpgSign=false",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  );
  return root;
};

const runConformance = (root, mutation) =>
  spawnSync(
    process.execPath,
    [resolve(root, "scripts", "run-conformance.mjs")],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        CONFORMANCE_FIXTURE_MUTATION: mutation,
        PATH: `${resolve(root, "bin")}${delimiter}${process.env.PATH ?? ""}`,
        npm_config_user_agent: "pnpm/10.34.4 npm/? node/v24",
      },
    },
  );

test("completes only after the full lane leaves HEAD and tracked files unchanged", async () => {
  const root = await createFixture();
  try {
    const head = runGit(root, "rev-parse", "HEAD");
    const result = runConformance(root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      new RegExp(`completed at unchanged clean HEAD ${head}`, "u"),
    );
    assert.equal(
      readFileSync(resolve(root, "pnpm-invocations.log"), "utf8")
        .trim()
        .split("\n").length,
      3,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

for (const mutation of ["dirty", "staged"]) {
  test(`fails when a conformance command leaves a tracked file ${mutation}`, async () => {
    const root = await createFixture();
    try {
      const result = runConformance(root, mutation);

      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /tracked staged or unstaged files are dirty during the conformance lane/u,
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
}

test("fails when a conformance command changes HEAD even if the tree stays clean", async () => {
  const root = await createFixture();
  try {
    const initialHead = runGit(root, "rev-parse", "HEAD");
    const result = runConformance(root, "head");
    const finalHead = runGit(root, "rev-parse", "HEAD");

    assert.notEqual(finalHead, initialHead);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /git HEAD changed during the conformance lane/u,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
