#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

import {
  assertSupportedNodeVersion,
  canonicalJson,
  hashDirectory,
  loadAndValidateBaseline,
  sha256,
} from "./external-conformance-lib.mjs";
import { networkDeniedCommand } from "./network-sandbox.mjs";

const baseline = loadAndValidateBaseline(
  new URL("../../w3c-spec/conformance/external-suites.json", import.meta.url),
);
const sandboxPath = new URL("./network-sandbox.mjs", import.meta.url);
const sandboxSha256 = sha256(await readFile(sandboxPath));
const selectedSourcePaths = [
  "packages/did-core-test-server/package.json",
  "packages/did-core-test-server/suites/utils.js",
  "packages/did-core-test-server/suites/implementations",
  ...baseline.selectedSuites.map(
    (suite) => `packages/did-core-test-server/suites/${suite}`,
  ),
];

const argument = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  if (index + 1 >= process.argv.length)
    throw new Error(`${name} requires a value`);
  return process.argv[index + 1];
};

const checkCiApproval = () => {
  if (process.env.CI !== "true") {
    throw new Error(
      "The external W3C harness is CI-only; set CI=true only in an isolated CI-equivalent runner",
    );
  }
  if (process.env.W3C_SUITE_DERIVED_ARTIFACTS_APPROVED !== "true") {
    throw new Error(
      "Maintainer/legal approval is required before preparing or executing the adapted upstream runtime; set W3C_SUITE_DERIVED_ARTIFACTS_APPROVED=true only after that decision",
    );
  }
  assertSupportedNodeVersion(process.version, baseline.toolchains.nodeMajor);
  const npm = run("npm", ["--version"], {
    capture: true,
    env: { PATH: process.env.PATH ?? "" },
  });
  if (npm !== baseline.toolchains.npm) {
    throw new Error(
      `Exact npm ${baseline.toolchains.npm} is required; got ${npm}`,
    );
  }
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    timeout: options.timeout,
    cwd: options.cwd,
    env: options.env,
  });
  if (result.error) throw result.error;
  if (result.signal) {
    throw new Error(
      `${command} exceeded its resource/time limit (${result.signal})`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with status ${result.status}`,
    );
  }
  return result.stdout?.trim() ?? "";
};

const assertMode0700 = async (path) => {
  const stat = await lstat(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o777) !== 0o700
  ) {
    throw new Error(
      `Ephemeral acquisition root is not a mode-0700 directory: ${path}`,
    );
  }
};

const makeTreeOwnerWritable = async (path) => {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    await chmod(path, 0o700);
    for (const entry of await readdir(path)) {
      await makeTreeOwnerWritable(join(path, entry));
    }
  } else {
    await chmod(path, 0o600);
  }
};

const makeTreeReadOnly = async (path) => {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    for (const entry of await readdir(path)) {
      await makeTreeReadOnly(join(path, entry));
    }
    await chmod(path, 0o555);
  } else {
    await chmod(path, 0o444);
  }
};

export const withMode0700TemporaryDirectory = async (callback) => {
  const temporaryBase = await realpath(tmpdir());
  const root = await mkdtemp(join(temporaryBase, "midnight-w3c-run-"));
  await chmod(root, 0o700);
  await assertMode0700(root);
  try {
    return await callback(root);
  } finally {
    try {
      await makeTreeOwnerWritable(root);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rm(root, { force: true, recursive: true });
  }
};

const verifyFile = async (root, path, expected) => {
  const actual = sha256(await readFile(join(root, path)));
  if (actual !== expected) {
    throw new Error(
      `Checksum mismatch for upstream ${path}: ${actual}, expected ${expected}`,
    );
  }
};

const verifySource = async (root) => {
  if (hashDirectory(root) !== baseline.upstream.extractedTreeSha256) {
    throw new Error("Checksum mismatch for complete extracted upstream tree");
  }
  for (const [path, expected] of Object.entries({
    ...baseline.upstream.lockfiles,
    ...baseline.upstream.verifiedFiles,
  })) {
    await verifyFile(root, path, expected);
  }
  const license = await readFile(join(root, "LICENSE.md"), "utf8");
  const rootPackage = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  const serverPackage = JSON.parse(
    await readFile(
      join(root, "packages/did-core-test-server/package.json"),
      "utf8",
    ),
  );
  const matcherPackage = JSON.parse(
    await readFile(
      join(root, "packages/jest-did-matcher/package.json"),
      "utf8",
    ),
  );
  if (!license.includes("W3C Document License")) {
    throw new Error(
      "Verified upstream license notice is not the W3C Document License notice",
    );
  }
  if (
    rootPackage.license !== "Apache-2.0" ||
    serverPackage.license !== undefined ||
    matcherPackage.license !== ""
  ) {
    throw new Error("Upstream mixed/unclear license metadata drifted");
  }
};

const copyVerifiedEntry = async (source, destination) => {
  const stat = await lstat(source);
  if (stat.isSymbolicLink())
    throw new Error(`Refusing symlink in source allowlist: ${source}`);
  if (stat.isDirectory()) {
    await mkdir(destination, { mode: 0o700 });
    for (const entry of (await readdir(source)).sort()) {
      await copyVerifiedEntry(join(source, entry), join(destination, entry));
    }
    return;
  }
  if (!stat.isFile())
    throw new Error(`Unsupported source allowlist entry: ${source}`);
  await writeFile(destination, await readFile(source), {
    flag: "wx",
    mode: 0o600,
  });
};

const copySelectedSources = async (extracted, serverRoot) => {
  for (const path of selectedSourcePaths) {
    const source = join(extracted, path);
    const relative = path.replace(/^packages\/did-core-test-server\/?/u, "");
    const destination = join(serverRoot, relative);
    await mkdir(resolve(destination, ".."), { recursive: true, mode: 0o700 });
    await copyVerifiedEntry(source, destination);
  }
  const actual = hashDirectory(serverRoot);
  if (actual !== baseline.upstream.runtime.allowlistedSourceSha256) {
    throw new Error(`Allowlisted upstream source checksum mismatch: ${actual}`);
  }
};

const inventory = async (nodeModules) => {
  const found = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".bin") continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory() && entry.name.startsWith("@")) {
        await walk(path);
      } else if (entry.isDirectory()) {
        try {
          const packageJson = JSON.parse(
            await readFile(join(path, "package.json"), "utf8"),
          );
          found.push(`${packageJson.name}@${packageJson.version}`);
          try {
            await walk(join(path, "node_modules"));
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
    }
  };
  await walk(nodeModules);
  return [...new Set(found)].sort();
};

const readArchive = async (archiveInput) => {
  if (archiveInput) return readFile(resolve(archiveInput));
  const response = await fetch(baseline.upstream.archiveUrl, {
    redirect: "follow",
  });
  if (!response.ok)
    throw new Error(
      `Upstream archive download failed: HTTP ${response.status}`,
    );
  if (!response.body) throw new Error("Upstream archive response has no body");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > baseline.upstream.runtime.resourceLimits.maxArchiveBytes) {
      throw new Error("Upstream archive exceeds the configured size limit");
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const withFreshW3cRuntime = async (
  { archiveInput, trustedFiles = {} } = {},
  callback = async ({ acquisition }) => acquisition,
) => {
  checkCiApproval();
  return withMode0700TemporaryDirectory(async (temporary) => {
    const archive = await readArchive(archiveInput);
    if (
      archive.byteLength >
      baseline.upstream.runtime.resourceLimits.maxArchiveBytes
    ) {
      throw new Error("Upstream archive exceeds the configured size limit");
    }
    if (sha256(archive) !== baseline.upstream.archiveSha256) {
      throw new Error(
        "Upstream archive checksum mismatch; refusing extraction or execution",
      );
    }
    const archivePath = join(temporary, "upstream.tar.gz");
    await writeFile(archivePath, archive, { flag: "wx", mode: 0o600 });
    run("tar", ["-xzf", archivePath, "-C", temporary], {
      env: { LANG: "C.UTF-8", PATH: process.env.PATH ?? "" },
    });
    const extracted = join(
      temporary,
      `did-test-suite-${baseline.upstream.commit}`,
    );
    await verifySource(extracted);
    if (process.platform !== "linux") {
      throw new Error(
        "The CI-only external harness requires Linux privilege-drop and network-namespace isolation",
      );
    }

    const installEnvironment = Object.fromEntries(
      Object.entries({
        HOME: temporary,
        LANG: "C.UTF-8",
        NIX_SSL_CERT_FILE: process.env.NIX_SSL_CERT_FILE,
        PATH: process.env.PATH ?? "",
        SSL_CERT_FILE: process.env.SSL_CERT_FILE,
        TMPDIR: temporary,
        npm_config_audit: "false",
        npm_config_cache: join(temporary, "npm-cache"),
        npm_config_fund: "false",
        npm_config_ignore_scripts: "true",
        npm_config_registry: "https://registry.npmjs.org/",
      }).filter(([, value]) => value !== undefined),
    );

    const serverInstall = join(temporary, "server-install");
    await mkdir(serverInstall, { mode: 0o700 });
    await cp(
      join(extracted, "packages/did-core-test-server/package-lock.json"),
      join(serverInstall, "package-lock.json"),
    );
    const serverPackage = JSON.parse(
      await readFile(
        join(extracted, "packages/did-core-test-server/package.json"),
        "utf8",
      ),
    );
    delete serverPackage.dependencies["jest-did-matcher"];
    await writeFile(
      join(serverInstall, "package.json"),
      canonicalJson(serverPackage),
      { flag: "wx" },
    );
    run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: serverInstall,
      env: installEnvironment,
    });

    const matcherInstall = join(temporary, "matcher-install");
    await mkdir(matcherInstall, { mode: 0o700 });
    for (const name of ["package.json", "package-lock.json"]) {
      await cp(
        join(extracted, "packages/jest-did-matcher", name),
        join(matcherInstall, name),
      );
    }
    await copyVerifiedEntry(
      join(extracted, "packages/jest-did-matcher/src"),
      join(matcherInstall, "src"),
    );
    if (
      hashDirectory(join(matcherInstall, "src")) !==
      baseline.upstream.runtime.matcherSourceSha256
    ) {
      throw new Error("Allowlisted matcher source checksum mismatch");
    }
    run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: matcherInstall,
      env: installEnvironment,
    });
    const matcherOutput = join(matcherInstall, "dist");
    await mkdir(matcherOutput, { mode: 0o700 });
    await makeTreeReadOnly(matcherInstall);
    await chmod(matcherOutput, 0o700);
    const realMatcherInstall = await realpath(matcherInstall);
    const matcherEnvironment = {
      HOME: temporary,
      LANG: "C.UTF-8",
      PATH: process.env.PATH ?? "",
      TMPDIR: temporary,
    };
    const babel = networkDeniedCommand(
      process.execPath,
      [
        `--max-old-space-size=${baseline.upstream.runtime.resourceLimits.maxOldSpaceMiB}`,
        "--permission",
        `--allow-fs-read=${realMatcherInstall}`,
        `--allow-fs-write=${matcherOutput}`,
        join(realMatcherInstall, "node_modules/babel-cli/bin/babel.js"),
        "--no-babelrc",
        "--plugins",
        "babel-plugin-transform-es2015-modules-commonjs,transform-object-rest-spread,transform-async-to-generator,macros",
        "src",
        "-d",
        "dist",
        "--ignore",
        "*.test.js",
      ],
      { environment: matcherEnvironment },
    );
    run(babel.command, babel.args, {
      cwd: realMatcherInstall,
      env: {},
      timeout: baseline.upstream.runtime.resourceLimits.timeoutSeconds * 1_000,
    });

    const runtimeRoot = join(temporary, "isolated-runtime");
    const serverRoot = join(runtimeRoot, "server");
    const trustedRoot = join(serverRoot, "trusted");
    const scratchRoot = join(temporary, "raw-results");
    await mkdir(serverRoot, { recursive: true, mode: 0o700 });
    await mkdir(trustedRoot, { mode: 0o700 });
    await mkdir(scratchRoot, { mode: 0o700 });
    await copySelectedSources(extracted, serverRoot);
    await rename(
      join(serverInstall, "node_modules"),
      join(serverRoot, "node_modules"),
    );
    const matcherRuntime = join(serverRoot, "node_modules/jest-did-matcher");
    await mkdir(matcherRuntime, { mode: 0o700 });
    await cp(matcherOutput, join(matcherRuntime, "dist"), { recursive: true });
    await cp(
      join(matcherInstall, "package.json"),
      join(matcherRuntime, "package.json"),
    );

    const trustedFileHashes = {};
    for (const [name, source] of Object.entries(trustedFiles).sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      if (!/^[a-z0-9][a-z0-9.-]*$/u.test(name))
        throw new Error(`Unsafe trusted runtime filename: ${name}`);
      const stat = await lstat(source);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error(
          `Trusted runtime input is not a regular file: ${source}`,
        );
      const bytes = await readFile(source);
      await writeFile(join(trustedRoot, name), bytes, {
        flag: "wx",
        mode: 0o400,
      });
      trustedFileHashes[name] = sha256(bytes);
    }

    const packages = await inventory(join(serverRoot, "node_modules"));
    const runtimeSha256 = hashDirectory(runtimeRoot);
    await makeTreeReadOnly(runtimeRoot);
    await assertMode0700(temporary);
    const acquisition = {
      archiveSha256: baseline.upstream.archiveSha256,
      commit: baseline.upstream.commit,
      ephemeral: true,
      installedLockfiles: baseline.upstream.runtime.installedLockfiles,
      lifecycleScripts: "disabled",
      matcherSourceSha256: baseline.upstream.runtime.matcherSourceSha256,
      node: process.version,
      npm: baseline.toolchains.npm,
      packageCount: packages.length,
      packageInventorySha256: sha256(canonicalJson(packages)),
      platform: process.platform,
      runtimeSha256,
      sandboxPrivilegePolicy: "drop-before-external-exec-v1",
      sandboxSha256,
      sourceAllowlist: baseline.upstream.runtime.sourceAllowlist,
      sourceSha256: baseline.upstream.runtime.allowlistedSourceSha256,
      temporaryRootMode: "0700",
    };
    return callback({
      acquisition,
      runtimeRoot,
      scratchRoot,
      trustedFileHashes,
    });
  });
};

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const acquisition = await withFreshW3cRuntime({
    archiveInput: argument("--archive"),
  });
  console.log(canonicalJson(acquisition).trim());
}
