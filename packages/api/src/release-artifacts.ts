export const MIDNIGHT_DID_API_VERSION = "0.4.0" as const;
export const MIDNIGHT_DID_PACKAGE_NAME =
  "@midnight-ntwrk/midnight-did-api" as const;
export const MIDNIGHT_DID_NPM_REGISTRY = "https://npm.pkg.github.com" as const;
export const MIDNIGHT_DID_GITHUB_REPOSITORY =
  "midnightntwrk/midnight-did" as const;
export const MIDNIGHT_DID_GHCR_ARTIFACT_REPOSITORY =
  "ghcr.io/midnightntwrk/midnight-did-zk-artifacts" as const;

export type MidnightDidReleaseChannel = "snapshot" | "rc" | "release";

export interface MidnightDidZkArtifactProviderLayout {
  readonly proverKey: "keys/{circuitId}.prover";
  readonly verifierKey: "keys/{circuitId}.verifier";
  readonly zkir: "zkir/{circuitId}.bzkir";
}

export interface MidnightDidGithubReleaseArtifactLocation {
  readonly repository: typeof MIDNIGHT_DID_GITHUB_REPOSITORY;
  readonly tag: string;
  readonly archiveUrl: string;
  readonly manifestUrl: string;
  readonly sha256Url: string;
}

export interface MidnightDidGhcrArtifactLocation {
  readonly repository: typeof MIDNIGHT_DID_GHCR_ARTIFACT_REPOSITORY;
  readonly reference: string;
}

export interface MidnightDidZkArtifactLocations {
  readonly version: string;
  readonly channel: MidnightDidReleaseChannel;
  readonly npm: {
    readonly packageName: typeof MIDNIGHT_DID_PACKAGE_NAME;
    readonly registry: typeof MIDNIGHT_DID_NPM_REGISTRY;
  };
  readonly ghcr: MidnightDidGhcrArtifactLocation;
  readonly githubRelease: MidnightDidGithubReleaseArtifactLocation | null;
  readonly workflowArtifactName: string;
  readonly archiveName: string;
  readonly manifestName: string;
  readonly sha256Name: string;
  readonly providerLayout: MidnightDidZkArtifactProviderLayout;
}

export const safeMidnightDidArtifactVersion = (version: string): string =>
  version.replace(/[^0-9A-Za-z._-]/gu, "_");

export const classifyMidnightDidReleaseVersion = (
  version: string,
): MidnightDidReleaseChannel => {
  if (/^\d+\.\d+\.\d+-snapshot\.[0-9A-Za-z._-]+$/u.test(version)) {
    return "snapshot";
  }
  if (/^\d+\.\d+\.\d+-rc[1-9]\d*$/u.test(version)) {
    return "rc";
  }
  if (/^\d+\.\d+\.\d+$/u.test(version)) {
    return "release";
  }
  throw new Error(`Unsupported Midnight DID release version shape: ${version}`);
};

export const createMidnightDidZkArtifactLocations = (
  version: string = MIDNIGHT_DID_API_VERSION,
): MidnightDidZkArtifactLocations => {
  const channel = classifyMidnightDidReleaseVersion(version);
  const safeVersion = safeMidnightDidArtifactVersion(version);
  const archiveName = `midnight-did-zk-artifacts-${safeVersion}.tar.gz`;
  const manifestName = `midnight-did-zk-artifacts-${safeVersion}.manifest.json`;
  const sha256Name = `${archiveName}.sha256`;
  const workflowArtifactName = `midnight-did-zk-artifacts-${version}`;
  const releaseTag = channel === "snapshot" ? null : `v${version}`;
  const githubRelease = releaseTag
    ? {
        repository: MIDNIGHT_DID_GITHUB_REPOSITORY,
        tag: releaseTag,
        archiveUrl: `https://github.com/${MIDNIGHT_DID_GITHUB_REPOSITORY}/releases/download/${releaseTag}/${archiveName}`,
        manifestUrl: `https://github.com/${MIDNIGHT_DID_GITHUB_REPOSITORY}/releases/download/${releaseTag}/${manifestName}`,
        sha256Url: `https://github.com/${MIDNIGHT_DID_GITHUB_REPOSITORY}/releases/download/${releaseTag}/${sha256Name}`,
      }
    : null;

  return {
    version,
    channel,
    npm: {
      packageName: MIDNIGHT_DID_PACKAGE_NAME,
      registry: MIDNIGHT_DID_NPM_REGISTRY,
    },
    ghcr: {
      repository: MIDNIGHT_DID_GHCR_ARTIFACT_REPOSITORY,
      reference: `${MIDNIGHT_DID_GHCR_ARTIFACT_REPOSITORY}:${version}`,
    },
    githubRelease,
    workflowArtifactName,
    archiveName,
    manifestName,
    sha256Name,
    providerLayout: {
      proverKey: "keys/{circuitId}.prover",
      verifierKey: "keys/{circuitId}.verifier",
      zkir: "zkir/{circuitId}.bzkir",
    },
  };
};

export const MIDNIGHT_DID_ZK_ARTIFACT_LOCATIONS =
  createMidnightDidZkArtifactLocations();
