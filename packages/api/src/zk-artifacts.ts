import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createMidnightDidZkArtifactLocations,
  MIDNIGHT_DID_API_VERSION,
  type MidnightDidGhcrArtifactLocation,
  type MidnightDidGithubReleaseArtifactLocation,
  type MidnightDidZkArtifactProviderLayout,
} from "./release-artifacts.js";

export type MidnightDidZkArtifactErrorCode =
  | "checksum_mismatch"
  | "download_failed"
  | "ghcr_pull_failed"
  | "manifest_mismatch"
  | "missing_archive"
  | "provider_path_mismatch"
  | "unsafe_archive";

export class MidnightDidZkArtifactError extends Error {
  constructor(
    readonly code: MidnightDidZkArtifactErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MidnightDidZkArtifactError";
  }
}

export interface MidnightDidZkArtifactCircuitManifest {
  readonly id: string;
  readonly files: {
    readonly prover: string;
    readonly verifier: string;
    readonly zkir: string;
  };
  readonly sha256: {
    readonly prover: string;
    readonly verifier: string;
    readonly zkir: string;
  };
  readonly bytes: {
    readonly prover: number;
    readonly verifier: number;
    readonly zkir: number;
  };
}

export interface MidnightDidZkArtifactManifest {
  readonly schema: "midnight-did-zk-artifacts";
  readonly schemaVersion: 1;
  readonly version: string;
  readonly packageName: string;
  readonly providerLayout: MidnightDidZkArtifactProviderLayout;
  readonly circuits: readonly MidnightDidZkArtifactCircuitManifest[];
}

export interface MidnightDidZkArtifactProviderRoots {
  readonly zkConfigPath: string;
  readonly fetchBaseUrl?: string;
  readonly providerLayout: MidnightDidZkArtifactProviderLayout;
}

export interface MidnightDidZkArtifactBundle {
  readonly archivePath: string;
  readonly manifest: MidnightDidZkArtifactManifest;
  readonly providers: MidnightDidZkArtifactProviderRoots;
  readonly zkConfigPath: string;
}

export interface MidnightDidUnpackZkArtifactArchiveOptions {
  readonly archivePath: string;
  readonly expectedManifest?: MidnightDidZkArtifactManifest;
  readonly expectedManifestJson?: unknown;
  readonly outputDir?: string;
  readonly version?: string;
  readonly fetchBaseUrl?: string;
}

export interface MidnightDidDownloadGithubReleaseZkArtifactsOptions {
  readonly fetch?: MidnightDidArtifactFetch;
  readonly location?: MidnightDidGithubReleaseArtifactLocation;
  readonly outputDir?: string;
  readonly tempDir?: string;
  readonly version?: string;
  readonly fetchBaseUrl?: string;
}

export interface MidnightDidPullGhcrZkArtifactsOptions {
  readonly location?: MidnightDidGhcrArtifactLocation;
  readonly orasCommand?: string;
  readonly outputDir?: string;
  readonly pullDir?: string;
  readonly version?: string;
  readonly fetchBaseUrl?: string;
}

export interface MidnightDidArtifactFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
  readonly text: () => Promise<string>;
}

export type MidnightDidArtifactFetch = (
  input: string,
) => Promise<MidnightDidArtifactFetchResponse>;

type ArtifactKind = "prover" | "verifier" | "zkir";

const expectedProviderLayout: MidnightDidZkArtifactProviderLayout = {
  proverKey: "keys/{circuitId}.prover",
  verifierKey: "keys/{circuitId}.verifier",
  zkir: "zkir/{circuitId}.bzkir",
};

const artifactKinds = ["prover", "verifier", "zkir"] as const;
const expectedPackageName = "@midnight-ntwrk/midnight-did-contract";

const sha256File = (filePath: string): string =>
  createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireString = (
  value: unknown,
  label: string,
  code: MidnightDidZkArtifactErrorCode = "manifest_mismatch",
): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new MidnightDidZkArtifactError(code, `${label} must be a string`);
  }
  return value;
};

const requireNumber = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      `${label} must be a non-negative integer`,
    );
  }
  return value;
};

const readJsonFile = (filePath: string): unknown =>
  JSON.parse(fs.readFileSync(filePath, "utf8"));

const readManifest = (manifestPath: string): MidnightDidZkArtifactManifest =>
  parseManifest(readJsonFile(manifestPath));

const parseManifest = (value: unknown): MidnightDidZkArtifactManifest => {
  if (!isRecord(value)) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      "ZK artifact manifest must be an object",
    );
  }
  if (value.schema !== "midnight-did-zk-artifacts") {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      `Unexpected ZK artifact manifest schema: ${String(value.schema)}`,
    );
  }
  if (value.schemaVersion !== 1) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      `Unexpected ZK artifact manifest schemaVersion: ${String(value.schemaVersion)}`,
    );
  }
  if (!isRecord(value.providerLayout)) {
    throw new MidnightDidZkArtifactError(
      "provider_path_mismatch",
      "ZK artifact manifest is missing providerLayout",
    );
  }

  const providerLayout = {
    proverKey: requireString(
      value.providerLayout.proverKey,
      "providerLayout.proverKey",
      "provider_path_mismatch",
    ),
    verifierKey: requireString(
      value.providerLayout.verifierKey,
      "providerLayout.verifierKey",
      "provider_path_mismatch",
    ),
    zkir: requireString(
      value.providerLayout.zkir,
      "providerLayout.zkir",
      "provider_path_mismatch",
    ),
  };
  if (
    JSON.stringify(providerLayout) !== JSON.stringify(expectedProviderLayout)
  ) {
    throw new MidnightDidZkArtifactError(
      "provider_path_mismatch",
      "ZK artifact providerLayout does not match Midnight JS provider roots",
    );
  }

  if (!Array.isArray(value.circuits) || value.circuits.length === 0) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      "ZK artifact manifest must include at least one circuit",
    );
  }

  const packageName = requireString(value.packageName, "packageName");
  if (packageName !== expectedPackageName) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      `ZK artifact packageName ${packageName} did not match ${expectedPackageName}`,
    );
  }

  return {
    schema: "midnight-did-zk-artifacts",
    schemaVersion: 1,
    version: requireString(value.version, "version"),
    packageName,
    providerLayout: expectedProviderLayout,
    circuits: value.circuits.map((circuit, index) =>
      parseCircuitManifest(circuit, index),
    ),
  };
};

const parseCircuitManifest = (
  value: unknown,
  index: number,
): MidnightDidZkArtifactCircuitManifest => {
  if (!isRecord(value)) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      `circuits[${index}] must be an object`,
    );
  }
  if (
    !isRecord(value.files) ||
    !isRecord(value.sha256) ||
    !isRecord(value.bytes)
  ) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      `circuits[${index}] must include files, sha256, and bytes`,
    );
  }

  const id = requireString(value.id, `circuits[${index}].id`);
  const files = {
    prover: requireString(value.files.prover, `${id}.files.prover`),
    verifier: requireString(value.files.verifier, `${id}.files.verifier`),
    zkir: requireString(value.files.zkir, `${id}.files.zkir`),
  };

  assertProviderPath(id, "prover", files.prover);
  assertProviderPath(id, "verifier", files.verifier);
  assertProviderPath(id, "zkir", files.zkir);

  return {
    id,
    files,
    sha256: {
      prover: requireString(value.sha256.prover, `${id}.sha256.prover`),
      verifier: requireString(value.sha256.verifier, `${id}.sha256.verifier`),
      zkir: requireString(value.sha256.zkir, `${id}.sha256.zkir`),
    },
    bytes: {
      prover: requireNumber(value.bytes.prover, `${id}.bytes.prover`),
      verifier: requireNumber(value.bytes.verifier, `${id}.bytes.verifier`),
      zkir: requireNumber(value.bytes.zkir, `${id}.bytes.zkir`),
    },
  };
};

const expectedProviderPath = (
  circuitId: string,
  kind: ArtifactKind,
): string => {
  switch (kind) {
    case "prover":
      return `keys/${circuitId}.prover`;
    case "verifier":
      return `keys/${circuitId}.verifier`;
    case "zkir":
      return `zkir/${circuitId}.bzkir`;
  }
};

const assertProviderPath = (
  circuitId: string,
  kind: ArtifactKind,
  relativePath: string,
): void => {
  const expected = expectedProviderPath(circuitId, kind);
  if (relativePath !== expected) {
    throw new MidnightDidZkArtifactError(
      "provider_path_mismatch",
      `${circuitId}: ${kind} path ${relativePath} must be ${expected}`,
    );
  }
};

const assertSafeArchiveEntry = (entry: string): void => {
  if (
    path.isAbsolute(entry) ||
    entry.includes("\\") ||
    entry.split("/").includes("..")
  ) {
    throw new MidnightDidZkArtifactError(
      "unsafe_archive",
      `Unsafe ZK artifact archive entry: ${entry}`,
    );
  }
};

const assertAllowedArchiveEntry = (entry: string): void => {
  if (
    entry === "manifest.json" ||
    /^keys\/[^/]+\.(prover|verifier)$/u.test(entry) ||
    /^zkir\/[^/]+\.bzkir$/u.test(entry)
  ) {
    return;
  }
  throw new MidnightDidZkArtifactError(
    "provider_path_mismatch",
    `Unexpected ZK artifact archive entry: ${entry}`,
  );
};

const listArchiveEntries = (archivePath: string): readonly string[] => {
  const result = spawnSync("tar", ["-tzf", archivePath], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new MidnightDidZkArtifactError(
      "unsafe_archive",
      `Could not list ZK artifact archive ${archivePath}:\n${result.stdout}${result.stderr}`,
    );
  }

  const entries = result.stdout
    .split(/\r?\n/u)
    .map((entry) => entry.replace(/^\.\//u, ""))
    .filter((entry) => entry.length > 0);

  if (!entries.includes("manifest.json")) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      "ZK artifact archive is missing manifest.json",
    );
  }

  for (const entry of entries) {
    assertSafeArchiveEntry(entry);
    if (!entry.endsWith("/")) {
      assertAllowedArchiveEntry(entry);
    }
  }

  return entries;
};

const extractArchive = (archivePath: string, outputDir: string): void => {
  fs.mkdirSync(outputDir, { recursive: true });
  const result = spawnSync("tar", ["-xzf", archivePath, "-C", outputDir], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new MidnightDidZkArtifactError(
      "unsafe_archive",
      `Could not extract ZK artifact archive ${archivePath}:\n${result.stdout}${result.stderr}`,
    );
  }
};

const verifyManifestFiles = (
  manifest: MidnightDidZkArtifactManifest,
  zkConfigPath: string,
): void => {
  for (const circuit of manifest.circuits) {
    for (const kind of artifactKinds) {
      const relativePath = circuit.files[kind];
      assertProviderPath(circuit.id, kind, relativePath);

      const artifactPath = path.join(zkConfigPath, ...relativePath.split("/"));
      if (!fs.existsSync(artifactPath)) {
        throw new MidnightDidZkArtifactError(
          "provider_path_mismatch",
          `${circuit.id}: missing ${kind} artifact at ${relativePath}`,
        );
      }

      const actualHash = sha256File(artifactPath);
      if (actualHash !== circuit.sha256[kind]) {
        throw new MidnightDidZkArtifactError(
          "checksum_mismatch",
          `${circuit.id}: ${kind} sha256 mismatch`,
        );
      }

      const actualBytes = fs.statSync(artifactPath).size;
      if (actualBytes !== circuit.bytes[kind]) {
        throw new MidnightDidZkArtifactError(
          "manifest_mismatch",
          `${circuit.id}: ${kind} byte size mismatch`,
        );
      }
    }
  }
};

const assertManifestMatches = (
  actual: MidnightDidZkArtifactManifest,
  expected: MidnightDidZkArtifactManifest,
): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      "Downloaded ZK artifact manifest does not match the archive manifest",
    );
  }
};

const assertManifestJsonMatches = (
  actual: unknown,
  expected: unknown,
): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      "Downloaded ZK artifact manifest does not match the archive manifest",
    );
  }
};

const parseSha256File = (contents: string): string => {
  const hash = contents.trim().split(/\s+/u)[0];
  if (!/^[0-9a-f]{64}$/u.test(hash)) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      "ZK artifact sha256 file does not contain a SHA-256 hex digest",
    );
  }
  return hash;
};

const verifyArchiveSha256 = (
  archivePath: string,
  sha256Contents: string,
): void => {
  const expected = parseSha256File(sha256Contents);
  const actual = sha256File(archivePath);
  if (actual !== expected) {
    throw new MidnightDidZkArtifactError(
      "checksum_mismatch",
      `ZK artifact archive sha256 mismatch for ${path.basename(archivePath)}: expected ${expected}, got ${actual}`,
    );
  }
};

const defaultFetch = async (
  input: string,
): Promise<MidnightDidArtifactFetchResponse> => {
  const fetchImplementation = globalThis.fetch;
  if (typeof fetchImplementation !== "function") {
    throw new MidnightDidZkArtifactError(
      "download_failed",
      "global fetch is not available; pass a fetch implementation",
    );
  }
  return fetchImplementation(input);
};

const fetchBinary = async (
  fetchImplementation: MidnightDidArtifactFetch,
  url: string,
): Promise<Buffer> => {
  const response = await fetchImplementation(url);
  if (!response.ok) {
    throw new MidnightDidZkArtifactError(
      "download_failed",
      `Could not download ZK artifact ${url}: ${response.status} ${response.statusText}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
};

const fetchText = async (
  fetchImplementation: MidnightDidArtifactFetch,
  url: string,
): Promise<string> => {
  const response = await fetchImplementation(url);
  if (!response.ok) {
    throw new MidnightDidZkArtifactError(
      "download_failed",
      `Could not download ZK artifact metadata ${url}: ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
};

const writeDownloadedFile = (
  directory: string,
  fileName: string,
  contents: Buffer | string,
): string => {
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, fileName);
  fs.writeFileSync(filePath, contents);
  return filePath;
};

const selectGhcrArchive = (
  directory: string,
  version: string,
): { archivePath: string; manifestPath?: string; sha256Path?: string } => {
  const locations = createMidnightDidZkArtifactLocations(version);
  const expectedArchive = path.join(directory, locations.archiveName);
  const archivePath = fs.existsSync(expectedArchive)
    ? expectedArchive
    : path.join(
        directory,
        fs
          .readdirSync(directory)
          .find((fileName) =>
            /^midnight-did-zk-artifacts-.+\.tar\.gz$/u.test(fileName),
          ) ?? "",
      );

  if (!archivePath || !fs.existsSync(archivePath)) {
    throw new MidnightDidZkArtifactError(
      "missing_archive",
      `GHCR pull did not produce ${locations.archiveName}`,
    );
  }

  const manifestPath = path.join(directory, locations.manifestName);
  const sha256Path = path.join(directory, locations.sha256Name);
  return {
    archivePath,
    manifestPath: fs.existsSync(manifestPath) ? manifestPath : undefined,
    sha256Path: fs.existsSync(sha256Path) ? sha256Path : undefined,
  };
};

export const createMidnightDidZkArtifactFetchBaseUrl = (
  baseUrl: string,
): string => baseUrl.replace(/\/+$/u, "");

export const createMidnightDidZkArtifactFetchUrls = (
  baseUrl: string,
  circuitId: string,
): {
  readonly proverKey: string;
  readonly verifierKey: string;
  readonly zkir: string;
} => {
  const root = createMidnightDidZkArtifactFetchBaseUrl(baseUrl);
  return {
    proverKey: `${root}/keys/${encodeURIComponent(circuitId)}.prover`,
    verifierKey: `${root}/keys/${encodeURIComponent(circuitId)}.verifier`,
    zkir: `${root}/zkir/${encodeURIComponent(circuitId)}.bzkir`,
  };
};

export const verifyMidnightDidZkArtifactManifest = ({
  expectedManifest,
  expectedManifestJson,
  manifestPath,
  version,
  zkConfigPath,
}: {
  readonly expectedManifest?: MidnightDidZkArtifactManifest;
  readonly expectedManifestJson?: unknown;
  readonly manifestPath: string;
  readonly version?: string;
  readonly zkConfigPath: string;
}): MidnightDidZkArtifactManifest => {
  const manifestJson = readJsonFile(manifestPath);
  const manifest = parseManifest(manifestJson);
  if (version && manifest.version !== version) {
    throw new MidnightDidZkArtifactError(
      "manifest_mismatch",
      `ZK artifact manifest version ${manifest.version} did not match ${version}`,
    );
  }
  if (expectedManifest) {
    assertManifestMatches(manifest, expectedManifest);
  }
  if (expectedManifestJson !== undefined) {
    assertManifestJsonMatches(manifestJson, expectedManifestJson);
  }
  verifyManifestFiles(manifest, zkConfigPath);
  return manifest;
};

export const unpackMidnightDidZkArtifactArchive = (
  options: MidnightDidUnpackZkArtifactArchiveOptions,
): MidnightDidZkArtifactBundle => {
  const archivePath = path.resolve(options.archivePath);
  if (!fs.existsSync(archivePath)) {
    throw new MidnightDidZkArtifactError(
      "missing_archive",
      `ZK artifact archive does not exist: ${archivePath}`,
    );
  }

  listArchiveEntries(archivePath);
  const outputDir =
    options.outputDir === undefined
      ? fs.mkdtempSync(path.join(os.tmpdir(), "midnight-did-zk-"))
      : path.resolve(options.outputDir);
  extractArchive(archivePath, outputDir);

  const manifest = verifyMidnightDidZkArtifactManifest({
    expectedManifest: options.expectedManifest,
    expectedManifestJson: options.expectedManifestJson,
    manifestPath: path.join(outputDir, "manifest.json"),
    version: options.version,
    zkConfigPath: outputDir,
  });

  return {
    archivePath,
    manifest,
    providers: {
      zkConfigPath: outputDir,
      fetchBaseUrl:
        options.fetchBaseUrl === undefined
          ? undefined
          : createMidnightDidZkArtifactFetchBaseUrl(options.fetchBaseUrl),
      providerLayout: manifest.providerLayout,
    },
    zkConfigPath: outputDir,
  };
};

export const downloadMidnightDidGithubReleaseZkArtifacts = async (
  options: MidnightDidDownloadGithubReleaseZkArtifactsOptions = {},
): Promise<MidnightDidZkArtifactBundle> => {
  const version = options.version ?? MIDNIGHT_DID_API_VERSION;
  const locations = createMidnightDidZkArtifactLocations(version);
  const location = options.location ?? locations.githubRelease;
  if (!location) {
    throw new MidnightDidZkArtifactError(
      "missing_archive",
      `GitHub Release ZK artifacts are not published for ${locations.channel} version ${version}`,
    );
  }

  const fetchImplementation = options.fetch ?? defaultFetch;
  const tempDir =
    options.tempDir === undefined
      ? fs.mkdtempSync(path.join(os.tmpdir(), "midnight-did-zk-download-"))
      : path.resolve(options.tempDir);
  const archivePath = writeDownloadedFile(
    tempDir,
    locations.archiveName,
    await fetchBinary(fetchImplementation, location.archiveUrl),
  );
  const sha256Contents = await fetchText(
    fetchImplementation,
    location.sha256Url,
  );
  writeDownloadedFile(tempDir, locations.sha256Name, sha256Contents);
  verifyArchiveSha256(archivePath, sha256Contents);

  const expectedManifestJson = JSON.parse(
    await fetchText(fetchImplementation, location.manifestUrl),
  );
  const expectedManifest = parseManifest(expectedManifestJson);
  writeDownloadedFile(
    tempDir,
    locations.manifestName,
    `${JSON.stringify(expectedManifest, null, 2)}\n`,
  );

  return unpackMidnightDidZkArtifactArchive({
    archivePath,
    expectedManifest,
    expectedManifestJson,
    fetchBaseUrl: options.fetchBaseUrl,
    outputDir: options.outputDir,
    version,
  });
};

export const pullMidnightDidGhcrZkArtifacts = (
  options: MidnightDidPullGhcrZkArtifactsOptions = {},
): MidnightDidZkArtifactBundle => {
  const version = options.version ?? MIDNIGHT_DID_API_VERSION;
  const locations = createMidnightDidZkArtifactLocations(version);
  const location = options.location ?? locations.ghcr;
  const pullDir =
    options.pullDir === undefined
      ? fs.mkdtempSync(path.join(os.tmpdir(), "midnight-did-zk-ghcr-"))
      : path.resolve(options.pullDir);

  fs.mkdirSync(pullDir, { recursive: true });
  const result = spawnSync(
    options.orasCommand ?? "oras",
    ["pull", location.reference, "--output", pullDir],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new MidnightDidZkArtifactError(
      "ghcr_pull_failed",
      `Could not pull ${location.reference} with ORAS:\n${result.stdout}${result.stderr}`,
    );
  }

  const { archivePath, manifestPath, sha256Path } = selectGhcrArchive(
    pullDir,
    version,
  );
  if (sha256Path) {
    verifyArchiveSha256(archivePath, fs.readFileSync(sha256Path, "utf8"));
  }

  return unpackMidnightDidZkArtifactArchive({
    archivePath,
    expectedManifest:
      manifestPath === undefined ? undefined : readManifest(manifestPath),
    expectedManifestJson:
      manifestPath === undefined ? undefined : readJsonFile(manifestPath),
    fetchBaseUrl: options.fetchBaseUrl,
    outputDir: options.outputDir,
    version,
  });
};
