import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createMidnightDidZkArtifactLocations,
  MIDNIGHT_DID_API_VERSION,
  safeMidnightDidArtifactVersion,
} from "../release-artifacts.js";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
) as { version: string };

describe("release artifact metadata", () => {
  it("keeps the embedded package version aligned with package.json", () => {
    expect(MIDNIGHT_DID_API_VERSION).toBe(packageJson.version);
  });

  it("describes the GHCR snapshot artifact without a GitHub Release asset", () => {
    const locations = createMidnightDidZkArtifactLocations(
      "0.4.0-snapshot.123.abcdef123456",
    );

    expect(locations.channel).toBe("snapshot");
    expect(locations.ghcr.reference).toBe(
      "ghcr.io/midnightntwrk/midnight-did-zk-artifacts:0.4.0-snapshot.123.abcdef123456",
    );
    expect(locations.githubRelease).toBeNull();
    expect(locations.workflowArtifactName).toBe(
      "midnight-did-zk-artifacts-0.4.0-snapshot.123.abcdef123456",
    );
  });

  it("describes RC GitHub Release assets and GHCR artifacts", () => {
    const locations = createMidnightDidZkArtifactLocations("0.4.0-rc2");

    expect(locations.channel).toBe("rc");
    expect(locations.archiveName).toBe(
      "midnight-did-zk-artifacts-0.4.0-rc2.tar.gz",
    );
    expect(locations.githubRelease).toEqual({
      repository: "midnightntwrk/midnight-did",
      tag: "v0.4.0-rc2",
      archiveUrl:
        "https://github.com/midnightntwrk/midnight-did/releases/download/v0.4.0-rc2/midnight-did-zk-artifacts-0.4.0-rc2.tar.gz",
      manifestUrl:
        "https://github.com/midnightntwrk/midnight-did/releases/download/v0.4.0-rc2/midnight-did-zk-artifacts-0.4.0-rc2.manifest.json",
      sha256Url:
        "https://github.com/midnightntwrk/midnight-did/releases/download/v0.4.0-rc2/midnight-did-zk-artifacts-0.4.0-rc2.tar.gz.sha256",
    });
  });

  it("describes final release artifacts", () => {
    const locations = createMidnightDidZkArtifactLocations("0.4.0");

    expect(locations.channel).toBe("release");
    expect(locations.githubRelease?.tag).toBe("v0.4.0");
    expect(locations.providerLayout).toEqual({
      proverKey: "keys/{circuitId}.prover",
      verifierKey: "keys/{circuitId}.verifier",
      zkir: "zkir/{circuitId}.bzkir",
    });
  });

  it("rejects unsupported version shapes", () => {
    expect(() => createMidnightDidZkArtifactLocations("next")).toThrow(
      /Unsupported Midnight DID release version shape/u,
    );
  });

  it("uses the same artifact filename escaping as the bundle builder", () => {
    expect(safeMidnightDidArtifactVersion("0.4.0+build.1")).toBe(
      "0.4.0_build.1",
    );
  });
});
