import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createMidnightDidZkArtifactFetchBaseUrl,
  createMidnightDidZkArtifactFetchUrls,
  downloadMidnightDidGithubReleaseZkArtifacts,
  MidnightDidZkArtifactError,
  type MidnightDidZkArtifactManifest,
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

const createFixtureArchive = (
  options: {
    readonly fileOverrides?: Partial<
      MidnightDidZkArtifactManifest["circuits"][number]["files"]
    >;
    readonly shaOverrides?: Partial<
      MidnightDidZkArtifactManifest["circuits"][number]["sha256"]
    >;
    readonly version?: string;
  } = {},
): {
  readonly archivePath: string;
  readonly manifest: MidnightDidZkArtifactManifest;
  readonly manifestPath: string;
  readonly sha256Contents: string;
} => {
  const tempRoot = makeTempRoot();
  const contentRoot = path.join(tempRoot, "content");
  const version = options.version ?? "0.4.0";
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

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});

describe("ZK artifact consumption helpers", () => {
  it("unpacks and verifies an archive for NodeZkConfigProvider roots", () => {
    const fixture = createFixtureArchive();
    const outputDir = path.join(makeTempRoot(), "unpacked");

    const bundle = unpackMidnightDidZkArtifactArchive({
      archivePath: fixture.archivePath,
      outputDir,
      version: "0.4.0",
    });

    expect(bundle.zkConfigPath).toBe(outputDir);
    expect(bundle.providers.zkConfigPath).toBe(outputDir);
    expect(bundle.manifest.version).toBe("0.4.0");
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

  it("downloads, verifies, and unpacks GitHub Release assets", async () => {
    const fixture = createFixtureArchive({ version: "0.4.0-rc2" });
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
          arrayBuffer: async () => Buffer.from(fixture.sha256Contents).buffer,
          text: async () => fixture.sha256Contents,
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () =>
          Buffer.from(JSON.stringify(fixture.manifest)).buffer,
        text: async () => JSON.stringify(fixture.manifest),
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
});
