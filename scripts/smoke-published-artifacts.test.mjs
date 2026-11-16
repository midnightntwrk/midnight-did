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

const root = fileURLToPath(new URL("../", import.meta.url));
const script = path.join(root, "scripts/smoke-published-artifacts.mjs");
const withFixture = (run) => {
  const temp = fs.mkdtempSync(
    path.join(os.tmpdir(), "did-injected-smoke-test-"),
  );
  try {
    const content = path.join(temp, "content");
    const write = (file, bytes) => {
      const target = path.join(content, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
    };
    const identity = {
      "compiler-version": "0.36.0",
      "compiler-commit": "a".repeat(40),
      "runtime-version": "0.21.0",
      "language-version": "0.28.0",
    };
    write("compiler/contract-info.json", JSON.stringify(identity));
    const metadata = { "manifest-version": "1", ...identity };
    for (const file of [
      "keys/add.prover",
      "keys/add.verifier",
      "zkir/add.bzkir",
      "compiler/contract-info.json",
    ]) {
      if (!file.startsWith("compiler/"))
        write(file, `fixture bytes for ${file}`);
      const bytes = fs.readFileSync(path.join(content, file));
      const [dir, name] = file.split("/");
      metadata[dir] ??= { type: "directory" };
      metadata[dir][name] = {
        type: "file",
        hash: createHash("sha256").update(bytes).digest("hex"),
        size: bytes.length,
      };
    }
    write("compiler/contract-manifest.json", JSON.stringify(metadata));
    const files = {
      prover: "keys/add.prover",
      verifier: "keys/add.verifier",
      zkir: "zkir/add.bzkir",
    };
    const descriptors = Object.fromEntries(
      Object.entries(files).map(([kind, file]) => {
        const [dir, name] = file.split("/");
        return [kind, metadata[dir][name]];
      }),
    );
    write(
      "manifest.json",
      JSON.stringify({
        schema: "midnight-did-zk-artifacts",
        schemaVersion: 1,
        packageName: "@midnight-ntwrk/midnight-did-contract",
        providerLayout: {
          proverKey: "keys/{circuitId}.prover",
          verifierKey: "keys/{circuitId}.verifier",
          zkir: "zkir/{circuitId}.bzkir",
        },
        compactCompilerVersion: "0.36.0",
        version: "0.6.0",
        circuits: [
          {
            id: "add",
            files,
            sha256: Object.fromEntries(
              Object.entries(descriptors).map(([kind, d]) => [kind, d.hash]),
            ),
            bytes: Object.fromEntries(
              Object.entries(descriptors).map(([kind, d]) => [kind, d.size]),
            ),
          },
        ],
      }),
    );
    // Child-only interception: reject external requests before sockets/DNS/TLS.
    // Real cross-fetch and SDK are unmodified; HTTP loopback remains exercised.
    const trap = path.join(temp, "trap.mjs");
    fs.writeFileSync(
      trap,
      `import http from 'node:http'; import https from 'node:https'; import {syncBuiltinESMExports} from 'node:module';
for (const protocol of [http, https]) { const original = protocol.request; protocol.request = function(input, ...args) { const host = typeof input === 'string' || input instanceof URL ? new URL(input).hostname : (input.hostname ?? input.host); if (host !== '127.0.0.1') throw new Error('UNEXPECTED_NETWORK_TRAP:' + host); return original.call(this, input, ...args); }; } syncBuiltinESMExports();\n`,
    );
    const smoke = (mode) => {
      const archive = path.join(temp, "bundle.tar.gz");
      execFileSync("tar", ["-czf", archive, "-C", content, "."]);
      return spawnSync(
        process.execPath,
        [
          "--import",
          trap,
          script,
          "--skip-npm",
          "--zk-archive",
          archive,
          "--zk-fetch-mode",
          mode,
        ],
        { cwd: root, encoding: "utf8", timeout: 10_000 },
      );
    };
    return run({ smoke, write, content });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
};

for (const mode of ["injected", "http"]) {
  test(`real SDK5 ${mode} CLI consumes all circuit kinds and compiler manifest`, () =>
    withFixture(({ smoke }) => {
      const result = smoke(mode);
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(
        result.stdout,
        /fetched 1 circuits through FetchZkConfigProvider/u,
      );
      assert.doesNotMatch(result.stderr, /UNEXPECTED_NETWORK_TRAP/u);
    }));
  for (const file of [
    "keys/add.prover",
    "keys/add.verifier",
    "zkir/add.bzkir",
    "compiler/contract-manifest.json",
  ]) {
    test(`real SDK5 ${mode} default integrity rejects corrupt ${file}`, () =>
      withFixture(({ smoke, write }) => {
        write(file, "corrupted bytes");
        const result = smoke(mode);
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.doesNotMatch(result.stderr, /UNEXPECTED_NETWORK_TRAP/u);
        assert.match(result.stderr, /integrity|manifest|JSON|hash/iu);
      }));
  }
}
