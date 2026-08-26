import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

const bannerSource = new URL("./conformance-banner.mjs", import.meta.url);
const runGit = (root, ...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const createFixture = async () => {
  const root = await mkdtemp(resolve(tmpdir(), "conformance-banner-"));
  await mkdir(resolve(root, "scripts"));
  await mkdir(resolve(root, "packages", "contract"), { recursive: true });
  await copyFile(
    bannerSource,
    resolve(root, "scripts", "conformance-banner.mjs"),
  );
  await writeFile(
    resolve(root, "package.json"),
    `${JSON.stringify({ name: "fixture-root", version: "1.2.3" }, null, 2)}\n`,
  );
  await writeFile(
    resolve(root, "packages", "contract", "package.json"),
    `${JSON.stringify({ name: "fixture-contract", version: "4.5.6" }, null, 2)}\n`,
  );
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

const runBanner = (root) =>
  spawnSync(
    process.execPath,
    [resolve(root, "scripts", "conformance-banner.mjs")],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_user_agent: "pnpm/10.34.4 npm/? node/v24",
      },
    },
  );

test("prints the exact clean HEAD and versions while ignoring untracked files", async () => {
  const root = await createFixture();
  try {
    await writeFile(resolve(root, "untracked.txt"), "ignored\n");
    const head = runGit(root, "rev-parse", "HEAD");
    const result = runBanner(root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`  clean git HEAD: ${head}`));
    assert.match(result.stdout, /  package: fixture-root@1\.2\.3/u);
    assert.match(result.stdout, /  contract: fixture-contract@4\.5\.6/u);
    assert.match(
      result.stdout,
      new RegExp(`  Node: ${process.version.replaceAll(".", "\\.")}`),
    );
    assert.match(result.stdout, /  pnpm: 10\.34\.4/u);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("fails closed for unstaged tracked changes", async () => {
  const root = await createFixture();
  try {
    await writeFile(resolve(root, "package.json"), '{"name":"dirty"}\n');
    const result = runBanner(root);

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /tracked staged or unstaged files are dirty/u);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("fails closed for staged tracked changes", async () => {
  const root = await createFixture();
  try {
    await writeFile(resolve(root, "package.json"), '{"name":"staged"}\n');
    runGit(root, "add", "package.json");
    const result = runBanner(root);

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /tracked staged or unstaged files are dirty/u);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
