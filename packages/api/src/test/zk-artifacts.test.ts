import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMidnightDidZkArtifactFetchBaseUrl,
  createMidnightDidZkArtifactFetchUrls,
  downloadMidnightDidGithubReleaseZkArtifacts,
  MidnightDidZkArtifactError,
  type MidnightDidZkArtifactManifest,
  pullMidnightDidGhcrZkArtifacts,
  unpackMidnightDidZkArtifactArchive,
} from "../zk-artifacts.js";

const tempRoots: string[] = [];

const sha256 = (filePath: string): string =>
  createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const makeTempRoot = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "did-zk-api-test-"));
  tempRoots.push(tempRoot);
  return tempRoot;
};

const writeFixtureFile = (
  root: string,
  relativePath: string,
  contents: string,
): string => {
  const filePath = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  return filePath;
};

const writeOctal = (
  header: Buffer,
  offset: number,
  length: number,
  value: number,
): void => {
  header.write(
    value
      .toString(8)
      .padStart(length - 1, "0")
      .slice(0, length - 1),
    offset,
    length - 1,
    "ascii",
  );
  header[offset + length - 1] = 0;
};

const tarEntry = (name: string, contents: Buffer): Buffer => {
  const header = Buffer.alloc(512);
  header.write(name, 0, Math.min(Buffer.byteLength(name), 100), "utf8");
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, contents.byteLength);
  writeOctal(header, 136, 12, 0);
  header.fill(" ", 148, 156);
  header[156] = "0".charCodeAt(0);
  header.write("ustar", 257, 5, "ascii");
  header.write("00", 263, 2, "ascii");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(checksum.toString(8).padStart(6, "0"), 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;

  const paddingLength = (512 - (contents.byteLength % 512)) % 512;
  return Buffer.concat([header, contents, Buffer.alloc(paddingLength)]);
};

const writeGzipTarArchive = (
  archivePath: string,
  entries: readonly { readonly name: string; readonly contents: string }[],
): void => {
  const body = Buffer.concat(
    entries.map((entry) => tarEntry(entry.name, Buffer.from(entry.contents))),
  );
  fs.writeFileSync(
    archivePath,
    gzipSync(Buffer.concat([body, Buffer.alloc(1024)])),
  );
};

const createFixtureArchive = (
  options: {
    readonly fileOverrides?: Partial<
      MidnightDidZkArtifactManifest["circuits"][number]["files"]
    >;
    readonly shaOverrides?: Partial<
      MidnightDidZkArtifactManifest["circuits"][number]["sha256"]
    >;
    readonly version?: string;
    readonly compilerMetadata?: boolean;
    readonly mutateMetadata?: (root: string) => void;
  } = {},
): {
  readonly archivePath: string;
  readonly manifest: MidnightDidZkArtifactManifest;
  readonly manifestPath: string;
  readonly sha256Contents: string;
} => {
  const tempRoot = makeTempRoot();
  const contentRoot = path.join(tempRoot, "content");
  const version = options.version ?? "0.5.0";
  const files = {
    prover: "keys/add.prover",
    verifier: "keys/add.verifier",
    zkir: "zkir/add.bzkir",
    ...options.fileOverrides,
  };
  const filePaths = {
    prover: writeFixtureFile(contentRoot, files.prover, "prover-key"),
    verifier: writeFixtureFile(contentRoot, files.verifier, "verifier-key"),
    zkir: writeFixtureFile(contentRoot, files.zkir, "zkir-bytes"),
  };
  const manifest: MidnightDidZkArtifactManifest = {
    schema: "midnight-did-zk-artifacts",
    schemaVersion: 1,
    version,
    packageName: "@midnight-ntwrk/midnight-did-contract",
    providerLayout: {
      proverKey: "keys/{circuitId}.prover",
      verifierKey: "keys/{circuitId}.verifier",
      zkir: "zkir/{circuitId}.bzkir",
    },
    circuits: [
      {
        id: "add",
        files,
        sha256: {
          prover: sha256(filePaths.prover),
          verifier: sha256(filePaths.verifier),
          zkir: sha256(filePaths.zkir),
          ...options.shaOverrides,
        },
        bytes: {
          prover: fs.statSync(filePaths.prover).size,
          verifier: fs.statSync(filePaths.verifier).size,
          zkir: fs.statSync(filePaths.zkir).size,
        },
      },
    ],
  };
  const manifestPath = path.join(contentRoot, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (options.compilerMetadata) {
    const identity = {
      "compiler-version": "0.36.0",
      "compiler-commit": "a".repeat(40),
      "language-version": "0.22.0",
      "runtime-version": "0.21.0",
    };
    const infoPath = writeFixtureFile(
      contentRoot,
      "compiler/contract-info.json",
      JSON.stringify(identity),
    );
    const descriptor = (filePath: string) => ({
      type: "file",
      hash: sha256(filePath),
      size: fs.statSync(filePath).size,
    });
    writeFixtureFile(
      contentRoot,
      "compiler/contract-manifest.json",
      JSON.stringify({
        "manifest-version": "1",
        ...identity,
        compiler: {
          type: "directory",
          "contract-info.json": descriptor(infoPath),
        },
        keys: {
          type: "directory",
          "add.prover": descriptor(filePaths.prover),
          "add.verifier": descriptor(filePaths.verifier),
        },
        zkir: { type: "directory", "add.bzkir": descriptor(filePaths.zkir) },
      }),
    );
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        ...manifest,
        compactCompilerVersion: "0.36.0 (aaaaaaa 2026-04-01)",
      }),
    );
  }
  options.mutateMetadata?.(contentRoot);

  const archivePath = path.join(
    tempRoot,
    `midnight-did-zk-artifacts-${version}.tar.gz`,
  );
  const result = spawnSync(
    "tar",
    ["-czf", archivePath, "-C", contentRoot, "."],
    {
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(`tar failed: ${result.stdout}${result.stderr}`);
  }

  return {
    archivePath,
    manifest,
    manifestPath,
    sha256Contents: `${sha256(archivePath)}  ${path.basename(archivePath)}\n`,
  };
};

const expectArtifactError = (
  action: () => unknown,
  code: MidnightDidZkArtifactError["code"],
): void => {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(MidnightDidZkArtifactError);
    expect((error as MidnightDidZkArtifactError).code).toBe(code);
    return;
  }
  throw new Error(`Expected MidnightDidZkArtifactError ${code}`);
};

const expectArtifactErrorAsync = async (
  action: () => Promise<unknown>,
  code: MidnightDidZkArtifactError["code"],
): Promise<void> => {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(MidnightDidZkArtifactError);
    expect((error as MidnightDidZkArtifactError).code).toBe(code);
    return;
  }
  throw new Error(`Expected MidnightDidZkArtifactError ${code}`);
};

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});

describe("ZK artifact consumption helpers", () => {
  type JsonObject = Record<string, any>;
  const jsonEdit = (
    root: string,
    file: string,
    mutate: (value: JsonObject) => void,
  ) => {
    const target = path.join(root, file);
    const value = JSON.parse(fs.readFileSync(target, "utf8"));
    mutate(value);
    fs.writeFileSync(target, JSON.stringify(value));
  };
  const metadataCases: [string, (root: string) => void][] = [
    [
      "missing info",
      (r) => fs.unlinkSync(path.join(r, "compiler/contract-info.json")),
    ],
    [
      "missing manifest",
      (r) => fs.unlinkSync(path.join(r, "compiler/contract-manifest.json")),
    ],
    [
      "missing pair",
      (r) => fs.rmSync(path.join(r, "compiler"), { recursive: true }),
    ],
    ...[
      "compiler/contract-info.json",
      "compiler/contract-manifest.json",
    ].flatMap(
      (file) =>
        [
          [
            `malformed ${file}`,
            (r: string) => fs.writeFileSync(path.join(r, file), "{"),
          ],
          [
            `nonobject ${file}`,
            (r: string) => fs.writeFileSync(path.join(r, file), "[]"),
          ],
        ] as [string, (root: string) => void][],
    ),
    [
      "manifest version",
      (r) =>
        jsonEdit(r, "compiler/contract-manifest.json", (v) => {
          v["manifest-version"] = 1;
        }),
    ],
    ...[
      "compiler-version",
      "compiler-commit",
      "language-version",
      "runtime-version",
    ].map(
      (field) =>
        [
          `${field} identity`,
          (r: string) =>
            jsonEdit(r, "compiler/contract-manifest.json", (v) => {
              v[field] = "different";
            }),
        ] as [string, (root: string) => void],
    ),
    ...[
      "0.36.0\n",
      "0.36.0 trailing",
      "0.36.0 (aaaaaaa 2026-02-30)",
      "00.36.0",
      "0.36.1",
      "0.36.0 (bbbbbbb 2026-04-01)",
    ].map(
      (version) =>
        [
          `bundle version ${JSON.stringify(version)}`,
          (r: string) =>
            jsonEdit(r, "manifest.json", (v) => {
              v.compactCompilerVersion = version;
            }),
        ] as [string, (root: string) => void],
    ),
    ...[
      "compiler-version",
      "compiler-commit",
      "language-version",
      "runtime-version",
    ].map(
      (field) =>
        [
          `${field} invalid in both`,
          (r: string) => {
            for (const file of [
              "compiler/contract-info.json",
              "compiler/contract-manifest.json",
            ])
              jsonEdit(r, file, (v) => {
                v[field] =
                  field === "compiler-commit"
                    ? "A".repeat(40)
                    : "0.36.0 (aaaaaaa 2026-04-01)";
              });
          },
        ] as [string, (root: string) => void],
    ),
    ...["compiler", "keys", "zkir"].map(
      (dir) =>
        [
          `${dir} directory descriptor`,
          (r: string) =>
            jsonEdit(r, "compiler/contract-manifest.json", (v) => {
              v[dir].type = "file";
            }),
        ] as [string, (root: string) => void],
    ),
    ...["type", "hash", "size"].flatMap((field) =>
      [
        "compiler/contract-info.json",
        "keys/add.prover",
        "keys/add.verifier",
        "zkir/add.bzkir",
      ].map(
        (file) =>
          [
            `${file} descriptor ${field}`,
            (r: string) =>
              jsonEdit(r, "compiler/contract-manifest.json", (v) => {
                const [dir, name] = file.split("/");
                v[dir][name][field] =
                  field === "type"
                    ? "directory"
                    : field === "hash"
                      ? "0".repeat(64)
                      : 999;
              }),
          ] as [string, (root: string) => void],
      ),
    ),
    [
      "unlisted included provider",
      (r) => {
        writeFixtureFile(r, "keys/extra.prover", "extra");
      },
    ],
    [
      "unlisted included provider corruption",
      (r) => {
        const f = writeFixtureFile(r, "keys/extra.prover", "extra");
        jsonEdit(r, "compiler/contract-manifest.json", (v) => {
          v.keys["extra.prover"] = { type: "file", hash: sha256(f), size: 5 };
        });
        fs.writeFileSync(f, "other");
      },
    ],
  ];
  it.each(metadataCases)(
    "rejects current compiler metadata: %s",
    (_name, mutateMetadata) => {
      const fixture = createFixtureArchive({
        compilerMetadata: true,
        mutateMetadata,
      });
      expectArtifactError(
        () =>
          unpackMidnightDidZkArtifactArchive({
            archivePath: fixture.archivePath,
            outputDir: path.join(makeTempRoot(), "out"),
          }),
        "manifest_mismatch",
      );
    },
  );
  it.each([
    "0.36.0",
    "0.36.0 (aaaaaaa 2026-04-01)",
    `0.36.0 (${"a".repeat(40)} 2026-04-01)`,
  ])("accepts exact bare/banner compiler identity: %s", (version) => {
    const fixture = createFixtureArchive({
      compilerMetadata: true,
      mutateMetadata: (r) =>
        jsonEdit(r, "manifest.json", (v) => {
          v.compactCompilerVersion = version;
        }),
    });
    const bundle = unpackMidnightDidZkArtifactArchive({
      archivePath: fixture.archivePath,
      outputDir: path.join(makeTempRoot(), "out"),
    });
    expect(bundle.manifest.compactCompilerVersion).toBe(version);
  });
  it.each([
    ["missing", undefined],
    ["null", null],
    ["negative", -1],
    ["fractional", 1.5],
    ["string", "10"],
  ])("rejects invalid descriptor size: %s", (_label, size) => {
    const fixture = createFixtureArchive({
      compilerMetadata: true,
      mutateMetadata: (r) =>
        jsonEdit(r, "compiler/contract-manifest.json", (v) => {
          v.keys["add.prover"].size = size;
        }),
    });
    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath: fixture.archivePath,
          outputDir: path.join(makeTempRoot(), "out"),
        }),
      "manifest_mismatch",
    );
  });
  it("accepts unlisted included providers only with valid descriptors", () => {
    const fixture = createFixtureArchive({
      compilerMetadata: true,
      mutateMetadata: (r) => {
        const f = writeFixtureFile(r, "keys/extra.prover", "extra");
        jsonEdit(r, "compiler/contract-manifest.json", (v) => {
          v.keys["extra.prover"] = { type: "file", hash: sha256(f), size: 5 };
          v.contract = {
            type: "directory",
            "index.js": { type: "file", hash: "0".repeat(64), size: 123 },
          };
        });
      },
    });
    expect(
      unpackMidnightDidZkArtifactArchive({
        archivePath: fixture.archivePath,
        outputDir: path.join(makeTempRoot(), "out"),
      }).manifest.circuits,
    ).toHaveLength(1);
  });
  it("keeps compiler identity in expected manifest comparison", () => {
    const fixture = createFixtureArchive({ compilerMetadata: true });
    const expected = JSON.parse(fs.readFileSync(fixture.manifestPath, "utf8"));
    expected.compactCompilerVersion = "0.36.1";
    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath: fixture.archivePath,
          expectedManifestJson: expected,
          outputDir: path.join(makeTempRoot(), "out"),
        }),
      "manifest_mismatch",
    );
  });
  it("requires metadata from this archive, not pre-existing output files", () => {
    const current = createFixtureArchive({ compilerMetadata: true });
    const outputDir = path.join(makeTempRoot(), "out");
    unpackMidnightDidZkArtifactArchive({
      archivePath: current.archivePath,
      outputDir,
    });
    const missing = createFixtureArchive({
      compilerMetadata: true,
      mutateMetadata: (root) =>
        fs.rmSync(path.join(root, "compiler"), { recursive: true }),
    });
    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath: missing.archivePath,
          outputDir,
        }),
      "manifest_mismatch",
    );
  });
  it("checks included providers without claiming pre-existing output files", () => {
    const fixture = createFixtureArchive({ compilerMetadata: true });
    const outputDir = makeTempRoot();
    writeFixtureFile(outputDir, "keys/unrelated.prover", "pre-existing");
    expect(
      unpackMidnightDidZkArtifactArchive({
        archivePath: fixture.archivePath,
        outputDir,
      }).manifest.circuits,
    ).toHaveLength(1);
  });
  it("rejects arbitrary compiler paths", () => {
    const fixture = createFixtureArchive({
      compilerMetadata: true,
      mutateMetadata: (r) => {
        writeFixtureFile(r, "compiler/extra.json", "{}");
      },
    });
    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath: fixture.archivePath,
        }),
      "provider_path_mismatch",
    );
  });

  it("unpacks and verifies an archive for NodeZkConfigProvider roots", () => {
    const fixture = createFixtureArchive({ compilerMetadata: true });
    const outputDir = path.join(makeTempRoot(), "unpacked");

    const bundle = unpackMidnightDidZkArtifactArchive({
      archivePath: fixture.archivePath,
      outputDir,
      version: "0.5.0",
    });

    expect(bundle.zkConfigPath).toBe(outputDir);
    expect(bundle.providers.zkConfigPath).toBe(outputDir);
    expect(bundle.manifest.version).toBe("0.5.0");
    expect(fs.existsSync(path.join(outputDir, "keys", "add.prover"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(outputDir, "zkir", "add.bzkir"))).toBe(true);
  });

  it("reports a missing archive distinctly", () => {
    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath: path.join(makeTempRoot(), "missing.tar.gz"),
        }),
      "missing_archive",
    );
  });

  it("reports checksum mismatches distinctly", () => {
    const fixture = createFixtureArchive({
      shaOverrides: { prover: "0".repeat(64) },
    });

    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath: fixture.archivePath,
          outputDir: path.join(makeTempRoot(), "unpacked"),
        }),
      "checksum_mismatch",
    );
  });

  it("accepts uppercase SHA-256 digests in the manifest", () => {
    const tempRoot = makeTempRoot();
    const baseline = createFixtureArchive({ version: "0.5.0" });
    const manifest = {
      ...baseline.manifest,
      circuits: baseline.manifest.circuits.map((circuit) => ({
        ...circuit,
        sha256: {
          prover: circuit.sha256.prover.toUpperCase(),
          verifier: circuit.sha256.verifier.toUpperCase(),
          zkir: circuit.sha256.zkir.toUpperCase(),
        },
      })),
    };
    const contentRoot = path.join(tempRoot, "content");
    fs.mkdirSync(contentRoot, { recursive: true });
    fs.cpSync(path.dirname(baseline.manifestPath), contentRoot, {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(contentRoot, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    const archivePath = path.join(
      tempRoot,
      "midnight-did-zk-artifacts-0.5.0.tar.gz",
    );
    const result = spawnSync(
      "tar",
      ["-czf", archivePath, "-C", contentRoot, "."],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      throw new Error(`tar failed: ${result.stdout}${result.stderr}`);
    }

    const bundle = unpackMidnightDidZkArtifactArchive({
      archivePath,
      outputDir: path.join(tempRoot, "unpacked"),
      version: "0.5.0",
    });

    expect(bundle.manifest.circuits[0].sha256.prover).toBe(
      baseline.manifest.circuits[0].sha256.prover,
    );
  });

  it("reports provider path mismatches distinctly", () => {
    const fixture = createFixtureArchive({
      fileOverrides: { prover: "keys/not-add.prover" },
    });

    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath: fixture.archivePath,
          outputDir: path.join(makeTempRoot(), "unpacked"),
        }),
      "provider_path_mismatch",
    );
  });

  it("rejects archive size-limit violations", () => {
    const fixture = createFixtureArchive();

    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath: fixture.archivePath,
          limits: { archiveBytes: 1 },
          outputDir: path.join(makeTempRoot(), "unpacked"),
        }),
      "unsafe_archive",
    );
  });

  it("rejects archive entry-count limit violations", () => {
    const fixture = createFixtureArchive();

    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath: fixture.archivePath,
          limits: { entryCount: 1 },
          outputDir: path.join(makeTempRoot(), "unpacked"),
        }),
      "unsafe_archive",
    );
  });

  it("rejects extracted size-limit violations", () => {
    const fixture = createFixtureArchive();

    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath: fixture.archivePath,
          limits: { extractedBytes: 1 },
          outputDir: path.join(makeTempRoot(), "unpacked"),
        }),
      "unsafe_archive",
    );
  });

  it("does not count pre-existing output files against extracted artifact limits", () => {
    const fixture = createFixtureArchive();
    const outputDir = path.join(makeTempRoot(), "unpacked");
    writeFixtureFile(outputDir, "unrelated.bin", "x".repeat(4096));

    const bundle = unpackMidnightDidZkArtifactArchive({
      archivePath: fixture.archivePath,
      limits: { extractedBytes: 2048 },
      outputDir,
    });

    expect(bundle.zkConfigPath).toBe(outputDir);
    expect(fs.existsSync(path.join(outputDir, "unrelated.bin"))).toBe(true);
  });

  it("rejects path traversal archive entries before extraction", () => {
    const tempRoot = makeTempRoot();
    const archivePath = path.join(tempRoot, "traversal.tar.gz");
    writeGzipTarArchive(archivePath, [
      { name: "../manifest.json", contents: "{}\n" },
    ]);

    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath,
          outputDir: path.join(makeTempRoot(), "unpacked"),
        }),
      "unsafe_archive",
    );
  });

  it("rejects unsafe archive entry types", () => {
    const tempRoot = makeTempRoot();
    const contentRoot = path.join(tempRoot, "content");
    fs.mkdirSync(path.join(contentRoot, "keys"), { recursive: true });
    fs.symlinkSync(
      "/tmp/unsafe-prover",
      path.join(contentRoot, "keys", "add.prover"),
    );
    fs.writeFileSync(path.join(contentRoot, "manifest.json"), "{}\n");
    const archivePath = path.join(
      tempRoot,
      "midnight-did-zk-artifacts-0.4.0.tar.gz",
    );
    const result = spawnSync(
      "tar",
      ["-czf", archivePath, "-C", contentRoot, "."],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      throw new Error(`tar failed: ${result.stdout}${result.stderr}`);
    }

    expectArtifactError(
      () =>
        unpackMidnightDidZkArtifactArchive({
          archivePath,
          outputDir: path.join(makeTempRoot(), "unpacked"),
        }),
      "unsafe_archive",
    );
  });

  it("downloads, verifies, and unpacks GitHub Release assets", async () => {
    const fixture = createFixtureArchive({
      version: "0.4.0-rc2",
      compilerMetadata: true,
    });
    const reorderedManifest = {
      ...JSON.parse(fs.readFileSync(fixture.manifestPath, "utf8")),
      circuits: fixture.manifest.circuits,
      providerLayout: fixture.manifest.providerLayout,
      packageName: fixture.manifest.packageName,
      version: fixture.manifest.version,
      schemaVersion: fixture.manifest.schemaVersion,
      schema: fixture.manifest.schema,
    };
    const requests: string[] = [];
    const fetch = async (input: string) => {
      requests.push(input);
      if (input.endsWith(".tar.gz")) {
        const archive = fs.readFileSync(fixture.archivePath);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () =>
            archive.buffer.slice(
              archive.byteOffset,
              archive.byteOffset + archive.byteLength,
            ),
          text: async () => archive.toString("utf8"),
        };
      }
      if (input.endsWith(".sha256")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () =>
            Buffer.from(fixture.sha256Contents.toUpperCase()).buffer,
          text: async () => fixture.sha256Contents.toUpperCase(),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () =>
          Buffer.from(JSON.stringify(reorderedManifest)).buffer,
        text: async () => JSON.stringify(reorderedManifest),
      };
    };

    const bundle = await downloadMidnightDidGithubReleaseZkArtifacts({
      fetch,
      outputDir: path.join(makeTempRoot(), "unpacked"),
      version: "0.4.0-rc2",
      fetchBaseUrl: "https://example.com/zk/",
    });

    expect(requests).toEqual([
      "https://github.com/midnightntwrk/midnight-did/releases/download/v0.4.0-rc2/midnight-did-zk-artifacts-0.4.0-rc2.tar.gz",
      "https://github.com/midnightntwrk/midnight-did/releases/download/v0.4.0-rc2/midnight-did-zk-artifacts-0.4.0-rc2.tar.gz.sha256",
      "https://github.com/midnightntwrk/midnight-did/releases/download/v0.4.0-rc2/midnight-did-zk-artifacts-0.4.0-rc2.manifest.json",
    ]);
    expect(bundle.providers.fetchBaseUrl).toBe("https://example.com/zk");
    expect(bundle.manifest.version).toBe("0.4.0-rc2");
  });

  it("reports failed network artifact downloads as typed errors", async () => {
    await expect(
      downloadMidnightDidGithubReleaseZkArtifacts({
        fetch: async () => ({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          arrayBuffer: async () => new ArrayBuffer(0),
          text: async () => "",
        }),
        outputDir: path.join(makeTempRoot(), "unpacked"),
        version: "0.4.0-rc2",
      }),
    ).rejects.toMatchObject({ code: "download_failed" });
  });

  it("rejects oversized network archives before buffering downloads", async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(2));

    await expect(
      downloadMidnightDidGithubReleaseZkArtifacts({
        fetch: async () => ({
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer,
          headers: { get: () => "2" },
          text: async () => "",
        }),
        limits: { archiveBytes: 1 },
        outputDir: path.join(makeTempRoot(), "unpacked"),
        version: "0.4.0-rc2",
      }),
    ).rejects.toMatchObject({ code: "unsafe_archive" });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("reports malformed downloaded manifests as typed errors", async () => {
    const fixture = createFixtureArchive({ version: "0.4.0-rc2" });
    const fetch = async (input: string) => {
      if (input.endsWith(".tar.gz")) {
        const archive = fs.readFileSync(fixture.archivePath);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () =>
            archive.buffer.slice(
              archive.byteOffset,
              archive.byteOffset + archive.byteLength,
            ),
          text: async () => archive.toString("utf8"),
        };
      }
      if (input.endsWith(".sha256")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => Buffer.from(fixture.sha256Contents).buffer,
          text: async () => fixture.sha256Contents,
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => Buffer.from("{").buffer,
        text: async () => "{",
      };
    };

    await expectArtifactErrorAsync(
      () =>
        downloadMidnightDidGithubReleaseZkArtifacts({
          fetch,
          outputDir: path.join(makeTempRoot(), "unpacked"),
          version: "0.4.0-rc2",
        }),
      "manifest_mismatch",
    );
  });

  it("builds FetchZkConfigProvider-compatible URLs", () => {
    expect(
      createMidnightDidZkArtifactFetchBaseUrl("https://example.com/zk/"),
    ).toBe("https://example.com/zk");
    expect(
      createMidnightDidZkArtifactFetchUrls("https://example.com/zk/", "add"),
    ).toEqual({
      proverKey: "https://example.com/zk/keys/add.prover",
      verifierKey: "https://example.com/zk/keys/add.verifier",
      zkir: "https://example.com/zk/zkir/add.bzkir",
    });
  });

  it("reports a missing GHCR archive distinctly after a successful pull", () => {
    const tempRoot = makeTempRoot();
    const fakeOras = path.join(tempRoot, "fake-oras.sh");
    fs.writeFileSync(fakeOras, "#!/usr/bin/env bash\nexit 0\n");
    fs.chmodSync(fakeOras, 0o755);

    expectArtifactError(
      () =>
        pullMidnightDidGhcrZkArtifacts({
          orasCommand: fakeOras,
          pullDir: path.join(tempRoot, "pull"),
          version: "0.4.0",
        }),
      "missing_archive",
    );
  });

  it("requires GHCR pulls to include the checksum sidecar", () => {
    const tempRoot = makeTempRoot();
    const fixture = createFixtureArchive({ version: "0.4.0" });
    const fakeOras = path.join(tempRoot, "fake-oras.sh");
    fs.writeFileSync(
      fakeOras,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'output_dir="$4"',
        'mkdir -p "$output_dir"',
        `cp ${JSON.stringify(fixture.archivePath)} "$output_dir/"`,
        "",
      ].join("\n"),
    );
    fs.chmodSync(fakeOras, 0o755);

    expectArtifactError(
      () =>
        pullMidnightDidGhcrZkArtifacts({
          orasCommand: fakeOras,
          pullDir: path.join(tempRoot, "pull"),
          version: "0.4.0",
        }),
      "missing_checksum",
    );
  });

  it("pulls, verifies, and unpacks GHCR OCI artifacts", () => {
    const tempRoot = makeTempRoot();
    const fixture = createFixtureArchive({
      version: "0.4.0",
      compilerMetadata: true,
    });
    const fakeOras = path.join(tempRoot, "fake-oras.sh");
    const manifestTarget = path.join(
      path.dirname(fixture.archivePath),
      "midnight-did-zk-artifacts-0.4.0.manifest.json",
    );
    fs.copyFileSync(fixture.manifestPath, manifestTarget);
    const shaTarget = `${fixture.archivePath}.sha256`;
    fs.writeFileSync(shaTarget, fixture.sha256Contents.toUpperCase());
    fs.writeFileSync(
      fakeOras,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'output_dir="$4"',
        'mkdir -p "$output_dir"',
        `cp ${JSON.stringify(fixture.archivePath)} "$output_dir/"`,
        `cp ${JSON.stringify(manifestTarget)} "$output_dir/"`,
        `cp ${JSON.stringify(shaTarget)} "$output_dir/"`,
        "",
      ].join("\n"),
    );
    fs.chmodSync(fakeOras, 0o755);

    const bundle = pullMidnightDidGhcrZkArtifacts({
      orasCommand: fakeOras,
      outputDir: path.join(tempRoot, "unpacked"),
      pullDir: path.join(tempRoot, "pull"),
      version: "0.4.0",
    });

    expect(bundle.manifest.version).toBe("0.4.0");
    expect(fs.existsSync(path.join(bundle.zkConfigPath, "manifest.json"))).toBe(
      true,
    );
  });
});
