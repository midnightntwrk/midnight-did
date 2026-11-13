#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checkerScript = path.join(
  repoRoot,
  "scripts/check-zk-artifact-bundle.mjs",
);

const sha256 = (filePath) =>
  createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const withTempDir = (callback) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "did-zk-check-test-"));
  try {
    return callback(tempRoot);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
};

const archiveContent = (tempRoot, contentRoot) => {
  const archivePath = path.join(tempRoot, "bundle.tar.gz");
  execFileSync("tar", ["-czf", archivePath, "-C", contentRoot, "."], {
    cwd: repoRoot,
    stdio: "pipe",
  });
  return archivePath;
};

const runChecker = (archivePath) =>
  spawnSync(process.execPath, [checkerScript, archivePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

const runCheckerWithDoubleDash = (archivePath) =>
  spawnSync(process.execPath, [checkerScript, "--", archivePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

const writeFixtureFile = (contentRoot, relativePath, content) => {
  const filePath = path.join(contentRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
};

const writeJson = (root, relativePath, value) =>
  writeFixtureFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
const rewriteJson = (root, relativePath, change) => {
  const value = JSON.parse(
    fs.readFileSync(path.join(root, relativePath), "utf8"),
  );
  const changed = change(value);
  writeJson(root, relativePath, changed === undefined ? value : changed);
};
const descriptor = (root, relativePath) => ({
  type: "file",
  size: fs.statSync(path.join(root, relativePath)).size,
  hash: sha256(path.join(root, relativePath)),
});
const changeInfo = (root, change) => {
  rewriteJson(root, "compiler/contract-info.json", change);
  rewriteJson(root, "compiler/contract-manifest.json", (manifest) => {
    manifest.compiler["contract-info.json"] = descriptor(
      root,
      "compiler/contract-info.json",
    );
  });
};
const compilerCommit = "b5d9e4dfc532fe47011c4f6296e254f4853eb469";
const compilerBanner = "0.36.0 (b5d9e4dfc 2026-11-03)";
const writeValidBundle = (
  tempRoot,
  { metadata = false, compilerVersion, mutate = () => {} } = {},
) => {
  const contentRoot = path.join(tempRoot, "content");
  fs.mkdirSync(contentRoot);

  const files = {
    prover: "keys/add.prover",
    verifier: "keys/add.verifier",
    zkir: "zkir/add.bzkir",
  };
  const sourceFiles = {
    prover: writeFixtureFile(contentRoot, files.prover, "prover-key"),
    verifier: writeFixtureFile(contentRoot, files.verifier, "verifier-key"),
    zkir: writeFixtureFile(contentRoot, files.zkir, "zkir"),
  };

  const manifest = {
    schema: "midnight-did-zk-artifacts",
    schemaVersion: 1,
    ...(compilerVersion === undefined
      ? {}
      : { compactCompilerVersion: compilerVersion }),
    circuits: [
      {
        id: "add",
        files,
        sha256: Object.fromEntries(
          Object.entries(sourceFiles).map(([kind, filePath]) => [
            kind,
            sha256(filePath),
          ]),
        ),
        bytes: Object.fromEntries(
          Object.entries(sourceFiles).map(([kind, filePath]) => [
            kind,
            fs.statSync(filePath).size,
          ]),
        ),
      },
    ],
  };
  fs.writeFileSync(
    path.join(contentRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  if (metadata) {
    manifest.compactCompilerVersion ??= compilerBanner;
    writeJson(contentRoot, "manifest.json", manifest);
    const identity = {
      "compiler-version": "0.36.0",
      "compiler-commit": compilerCommit,
      "language-version": "0.28.0",
      "runtime-version": "0.21.0",
    };
    writeJson(contentRoot, "compiler/contract-info.json", identity);
    writeJson(contentRoot, "compiler/contract-manifest.json", {
      "manifest-version": "1",
      ...identity,
      compiler: {
        type: "directory",
        "contract-info.json": descriptor(
          contentRoot,
          "compiler/contract-info.json",
        ),
      },
      keys: {
        type: "directory",
        "add.prover": descriptor(contentRoot, files.prover),
        "add.verifier": descriptor(contentRoot, files.verifier),
      },
      zkir: {
        type: "directory",
        "add.bzkir": descriptor(contentRoot, files.zkir),
        // The compiler also describes outputs intentionally absent from a
        // provider archive. They are not required for bundle validation.
        "add.zkir": { type: "file", size: 123, hash: "0".repeat(64) },
      },
      contract: {
        type: "directory",
        "index.js": { type: "file", size: 123, hash: "0".repeat(64) },
        "index.js.map": { type: "file", size: 123, hash: "0".repeat(64) },
      },
    });
  }
  mutate(contentRoot);
  return archiveContent(tempRoot, contentRoot);
};

test("check-zk-artifact-bundle accepts a valid provider bundle", () =>
  withTempDir((tempRoot) => {
    const result = runChecker(writeValidBundle(tempRoot));

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 circuits verified/u);
  }));

test("check-zk-artifact-bundle accepts pnpm-style -- argument passthrough", () =>
  withTempDir((tempRoot) => {
    const result = runCheckerWithDoubleDash(writeValidBundle(tempRoot));

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 circuits verified/u);
  }));

test("check-zk-artifact-bundle reports a missing manifest even with earlier entry errors", () =>
  withTempDir((tempRoot) => {
    const contentRoot = path.join(tempRoot, "content");
    fs.mkdirSync(contentRoot);
    writeFixtureFile(contentRoot, "unexpected.txt", "not a provider bundle");

    const result = runChecker(archiveContent(tempRoot, contentRoot));
    const output = `${result.stdout}\n${result.stderr}`;

    assert.equal(result.status, 1, output);
    assert.match(output, /unexpected tar entry: unexpected\.txt/u);
    assert.match(output, /missing manifest\.json/u);
  }));

for (const version of ["0.36.0", compilerBanner]) {
  test(`accepts the exact metadata pair for current compiler ${version}`, () =>
    withTempDir((tempRoot) => {
      const result = runChecker(
        writeValidBundle(tempRoot, {
          metadata: true,
          compilerVersion: version,
        }),
      );
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /1 circuits verified/u);
    }));
}

test("owning builder output is accepted without archive-external compiler outputs", () =>
  withTempDir((tempRoot) => {
    writeValidBundle(tempRoot, { metadata: true });
    const outDir = path.join(tempRoot, "built");
    const built = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, "scripts/build-zk-artifact-bundle.mjs"),
        "--managed-root",
        path.join(tempRoot, "content"),
        "--out-dir",
        outDir,
        "--version",
        "0.0.0-fixture",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, COMPACT_COMPILER_VERSION: compilerBanner },
      },
    );
    assert.equal(built.status, 0, built.stderr);
    const result = runChecker(
      path.join(outDir, "midnight-did-zk-artifacts-0.0.0-fixture.tar.gz"),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 circuits verified/u);
  }));

for (const version of [
  undefined,
  "0.31.1",
  "0.35.999",
  "0.35.0 (abcdef0 2026-01-01)",
]) {
  test(`explicit legacy key-only schema-1 checking: ${version ?? "undeclared compiler"}`, () =>
    withTempDir((tempRoot) => {
      const result = runChecker(
        writeValidBundle(tempRoot, { compilerVersion: version }),
      );
      assert.equal(result.status, 0, result.stderr);
    }));
}

const rejectBundle = (name, options, expected) =>
  test(name, () =>
    withTempDir((tempRoot) => {
      const result = runChecker(writeValidBundle(tempRoot, options));
      const output = `${result.stdout}\n${result.stderr}`;
      assert.equal(result.status, 1, output);
      assert.match(output, expected);
    }),
  );

for (const version of ["0.36.0", "0.36.1", "1.0.0", compilerBanner]) {
  rejectBundle(
    `requires the pair for declared current compiler ${version}`,
    { compilerVersion: version },
    /compiler metadata pair required/u,
  );
}
for (const missing of ["contract-info.json", "contract-manifest.json"]) {
  for (const version of [compilerBanner, "0.31.1"]) {
    rejectBundle(
      `rejects an unpaired ${missing} even for ${version}`,
      {
        metadata: true,
        compilerVersion: version,
        mutate: (root) => fs.unlinkSync(path.join(root, "compiler", missing)),
      },
      /compiler metadata pair required/u,
    );
  }
}
for (const version of [
  "0.36.0garbage",
  "prefix 0.36.0",
  "0.36.0-rc.1",
  "0.36.0\n",
  "0.36.0 (b5d9e4dfc 2026-02-30)",
]) {
  rejectBundle(
    `strictly rejects malformed compiler banner ${JSON.stringify(version)}`,
    { metadata: true, compilerVersion: version },
    /bundle compiler version:/u,
  );
}
for (const file of ["contract-info.json", "contract-manifest.json"]) {
  for (const content of ["{bad json", "[]", "null"]) {
    rejectBundle(
      `rejects invalid ${file}: ${content}`,
      {
        metadata: true,
        mutate: (root) => writeFixtureFile(root, `compiler/${file}`, content),
      },
      /invalid JSON object/u,
    );
  }
}
for (const field of ["hash", "size", "type"]) {
  rejectBundle(
    `rejects corrupt info ${field} descriptor`,
    {
      metadata: true,
      mutate: (root) =>
        rewriteJson(root, "compiler/contract-manifest.json", (m) => {
          m.compiler["contract-info.json"][field] = {
            hash: "0".repeat(64),
            size: 1,
            type: "directory",
          }[field];
        }),
    },
    /compiler descriptor (sha256|byte size) mismatch|invalid compiler file descriptor/u,
  );
}
rejectBundle(
  "rejects changed info bytes without descriptor refresh",
  {
    metadata: true,
    mutate: (root) =>
      fs.appendFileSync(path.join(root, "compiler/contract-info.json"), " "),
  },
  /compiler descriptor (sha256|byte size) mismatch/u,
);
for (const field of [
  "compiler-version",
  "compiler-commit",
  "language-version",
  "runtime-version",
]) {
  rejectBundle(
    `rejects metadata ${field} identity mismatch with a refreshed info digest`,
    {
      metadata: true,
      mutate: (root) =>
        changeInfo(root, (info) => {
          info[field] = "different";
        }),
    },
    new RegExp(`compiler metadata ${field} identity mismatch`, "u"),
  );
}
rejectBundle(
  "rejects bundle/metadata compiler version mismatch",
  {
    metadata: true,
    compilerVersion: "0.36.1",
  },
  /bundle\/compiler metadata compiler-version mismatch/u,
);
rejectBundle(
  "rejects bundle/metadata compiler commit mismatch",
  {
    metadata: true,
    compilerVersion: "0.36.0 (abcdef0 2026-11-03)",
  },
  /bundle\/compiler metadata compiler-commit mismatch/u,
);
rejectBundle(
  "rejects a noncanonical metadata commit even with matching info identity",
  {
    metadata: true,
    mutate: (root) => {
      changeInfo(root, (i) => {
        i["compiler-commit"] += "\n";
      });
      rewriteJson(root, "compiler/contract-manifest.json", (m) => {
        m["compiler-commit"] += "\n";
      });
    },
  },
  /invalid compiler metadata compiler-commit/u,
);
rejectBundle(
  "requires a declared compiler identity when metadata is present",
  {
    metadata: true,
    mutate: (root) =>
      rewriteJson(root, "manifest.json", (m) => {
        delete m.compactCompilerVersion;
      }),
  },
  /bundle\/compiler metadata compiler-version mismatch/u,
);
rejectBundle(
  "rejects unsupported compiler manifest-version",
  {
    metadata: true,
    mutate: (root) =>
      rewriteJson(root, "compiler/contract-manifest.json", (m) => {
        m["manifest-version"] = "2";
      }),
  },
  /unexpected compiler manifest-version/u,
);
rejectBundle(
  "rejects a decorated metadata version even if the parsed version matches",
  {
    metadata: true,
    mutate: (root) => {
      changeInfo(root, (i) => {
        i["compiler-version"] = compilerBanner;
      });
      rewriteJson(root, "compiler/contract-manifest.json", (m) => {
        m["compiler-version"] = compilerBanner;
      });
    },
  },
  /expected a bare version/u,
);
rejectBundle(
  "rejects arbitrary files beneath compiler",
  {
    metadata: true,
    mutate: (root) => writeFixtureFile(root, "compiler/extra.json", "{}"),
  },
  /unexpected tar entry: compiler\/extra\.json/u,
);

for (const relativePath of ["keys/unlisted.prover", "zkir/unlisted.bzkir"]) {
  rejectBundle(
    `checks included file descriptors even outside manifest.circuits: ${relativePath}`,
    {
      metadata: true,
      mutate: (root) =>
        writeFixtureFile(root, relativePath, "unlisted artifact"),
    },
    /invalid compiler file descriptor/u,
  );
}

for (const relativePath of [
  "compiler/contract-info.json",
  "compiler/contract-manifest.json",
  "manifest.json",
  "keys/add.verifier",
  "zkir/add.bzkir",
  "../add.prover",
  "/keys/add.prover",
  "keys\\add.prover",
]) {
  rejectBundle(
    `rejects unsafe or wrong-role prover path ${relativePath}`,
    {
      metadata: true,
      mutate: (root) =>
        rewriteJson(root, "manifest.json", (m) => {
          m.circuits[0].files.prover = relativePath;
        }),
    },
    /unsafe or unexpected prover path/u,
  );
}
for (const [kind, file, directory] of [
  ["prover", "add.prover", "keys"],
  ["verifier", "add.verifier", "keys"],
  ["zkir", "add.bzkir", "zkir"],
]) {
  for (const field of ["hash", "size", "type", "missing"]) {
    rejectBundle(
      `checks compiler descriptor ${kind}/${field} independently of bundle hashes`,
      {
        metadata: true,
        mutate: (root) =>
          rewriteJson(root, "compiler/contract-manifest.json", (m) => {
            if (field === "missing") delete m[directory][file];
            else
              m[directory][file][field] = {
                hash: "0".repeat(64),
                size: 0,
                type: "directory",
              }[field];
          }),
      },
      /compiler descriptor (sha256|byte size) mismatch|invalid compiler file descriptor/u,
    );
  }
  for (const field of ["sha256", "bytes"]) {
    rejectBundle(
      `retains existing manifest.circuits ${kind}/${field} validation`,
      {
        metadata: true,
        mutate: (root) =>
          rewriteJson(root, "manifest.json", (m) => {
            m.circuits[0][field][kind] =
              field === "sha256" ? "0".repeat(64) : 0;
          }),
      },
      new RegExp(`${kind} (sha256|byte size) mismatch`, "u"),
    );
  }
}

test("rejects unsafe tar paths before extraction", () =>
  withTempDir((tempRoot) => {
    writeValidBundle(tempRoot);
    const archivePath = path.join(tempRoot, "unsafe.tar.gz");
    execFileSync("tar", [
      "-czf",
      archivePath,
      "--transform=s#keys/add.prover#../escape.prover#",
      "-C",
      path.join(tempRoot, "content"),
      ".",
    ]);
    const result = runChecker(archivePath);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /unsafe tar entry: \.\.\/escape\.prover/u);
    assert.equal(fs.existsSync(path.join(tempRoot, "escape.prover")), false);
  }));
