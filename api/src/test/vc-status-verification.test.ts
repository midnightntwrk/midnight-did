import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertVcNotRevoked,
  evaluateVcStatus,
  loadVcStatusRegistryFromFile,
  statusRegistryFixturePath,
  VC_STATUS_PURPOSE,
  VcRevocationError,
  VcStatusUnavailableError,
  type VerifiableCredential,
} from "../vc-status";

const SAMPLE_CREDENTIAL: VerifiableCredential = {
  id: "urn:vc:university:stu-001",
  credentialStatus: {
    id: "urn:vc-status:university-diploma:v1",
    type: "MidnightStatusList",
    statusPurpose: VC_STATUS_PURPOSE,
    statusRef: "urn:vc-status:university-diploma:v1:stu-001",
  },
};

describe("VC status reference verification", () => {
  it("accepts an active status registry snapshot", () => {
    const registry = loadVcStatusRegistryFromFile(
      statusRegistryFixturePath("status-registry-active.json"),
    );
    const decision = evaluateVcStatus(SAMPLE_CREDENTIAL, registry);

    expect(decision.state).toBe("active");
    expect(decision.statusRef).toBe("urn:vc-status:university-diploma:v1");
    expect(decision.statusEntry).toBe(
      "urn:vc-status:university-diploma:v1:stu-001",
    );
  });

  it("rejects the same credential when it is revoked in registry state", () => {
    const registry = loadVcStatusRegistryFromFile(
      statusRegistryFixturePath("status-registry-revoked.json"),
    );
    expect(() => assertVcNotRevoked(SAMPLE_CREDENTIAL, registry)).toThrow(
      VcRevocationError,
    );
  });

  it("soft-fails missing registry as unknown instead of hard-failing", () => {
    const decision = evaluateVcStatus(SAMPLE_CREDENTIAL);
    expect(decision.state).toBe("unknown");
    expect(decision.reason).toContain("registry unavailable");
  });

  it("fails closed when assert path cannot verify status state", () => {
    expect(() => assertVcNotRevoked(SAMPLE_CREDENTIAL)).toThrow(
      VcStatusUnavailableError,
    );
  });

  it("rejects malformed persisted registry entries with field-path diagnostics", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "vc-status-registry-"));
    const fixturePath = path.join(dir, "status-registry.json");
    try {
      writeFileSync(
        fixturePath,
        JSON.stringify({
          statusRef: "urn:vc-status:university-diploma:v1",
          statusPurpose: VC_STATUS_PURPOSE,
          issuedAt: "2026-05-14T00:00:00Z",
          credentials: {
            "urn:vc-status:university-diploma:v1:stu-001": {
              state: "suspended",
            },
          },
        }),
      );

      expect(() => loadVcStatusRegistryFromFile(fixturePath)).toThrow(
        /statusRegistry\.credentials\.urn:vc-status:university-diploma:v1:stu-001\.state must be one of: active, revoked/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects non-object persisted status credentials before runtime use", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "vc-status-registry-"));
    const fixturePath = path.join(dir, "status-registry.json");
    try {
      writeFileSync(
        fixturePath,
        JSON.stringify({
          statusRef: "urn:vc-status:university-diploma:v1",
          statusPurpose: VC_STATUS_PURPOSE,
          issuedAt: "2026-05-14T00:00:00Z",
          credentials: [],
        }),
      );

      expect(() => loadVcStatusRegistryFromFile(fixturePath)).toThrow(
        /statusRegistry\.credentials must be an object, got array/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
