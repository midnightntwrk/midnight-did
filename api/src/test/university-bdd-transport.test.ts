import { describe, expect, it } from "vitest";

import {
  computeCredentialDigest,
  type UniversityIssuanceDecision,
  type UniversityIssuanceRequestContext,
  type UniversityTransport,
} from "../university-bdd";
import {
  loadUniversityScenarioFromFile,
  universityScenarioFixturePath,
} from "../university-bdd-fixtures";
import {
  createTransportWithRetry,
  createUniversityTransport,
  resolveUniversityRuntimeMode,
} from "../university-bdd-transport";

describe("University BDD transport runtime", () => {
  const fixture = loadUniversityScenarioFromFile(
    universityScenarioFixturePath("university-bdd.fixture.json"),
  );

  it("resolves unknown runtime modes to simulator", () => {
    expect(resolveUniversityRuntimeMode()).toBe("simulator");
    expect(resolveUniversityRuntimeMode("")).toBe("simulator");
    expect(resolveUniversityRuntimeMode("unexpected")).toBe("simulator");
    expect(resolveUniversityRuntimeMode("standalone")).toBe("standalone");
    expect(resolveUniversityRuntimeMode("simulator")).toBe("simulator");
  });

  it("issues simulator credentials with deterministic proof digests", async () => {
    const transport = createUniversityTransport(fixture, "simulator", {
      now: fixture.createdAt,
    });
    const student = fixture.students[0]!;

    const response = await transport.issueDiploma({
      student,
      issuedAt: fixture.createdAt,
      credentialStatusRef: fixture.university.credentialStatusRef,
      statusRef: `urn:vc-status:midnight:university-diploma:2026:${student.studentId}`,
      studentId: student.studentId,
      studentDid: student.did,
      universityDid: fixture.university.did,
      requestReference: `request:${fixture.university.did}:${student.studentId}`,
    });

    expect(response.issued).toBe(true);
    expect(response.credential?.proofDigest).toBe(
      computeCredentialDigest({
        ...response.credential!,
        proofDigest: "",
      }),
    );
  });

  it("keeps standalone mode behind an actionable guard", async () => {
    const transport = createUniversityTransport(fixture, "standalone");

    await expect(
      transport.issueDiploma({} as UniversityIssuanceRequestContext),
    ).rejects.toThrow(/Standalone transport is not implemented yet/);
  });

  it("records timeout retry metrics per transport operation", async () => {
    let attempts = 0;
    const baseTransport: UniversityTransport = {
      async issueDiploma(): Promise<UniversityIssuanceDecision> {
        attempts += 1;
        if (attempts === 1) {
          const error = new Error("timeout from test transport");
          error.name = "AbortError";
          throw error;
        }

        return {
          issued: false,
          statusState: "active",
          statusReason: "retry-ok",
        };
      },
      async requestPresentation() {
        throw new Error("not used");
      },
      async requestDiscount() {
        throw new Error("not used");
      },
    };

    const transport = createTransportWithRetry(baseTransport, {
      maxRetries: 1,
      retryDelayMs: 0,
      timeoutMs: 0,
    });
    const before = transport.snapshot();

    await expect(
      transport.transport.issueDiploma({} as UniversityIssuanceRequestContext),
    ).resolves.toMatchObject({
      issued: false,
      statusReason: "retry-ok",
    });

    expect(transport.stepChecks(["issueDiploma"], before)).toEqual([
      "Transport operation issueDiploma: attempts=2, retries=1, timeoutEvents=1",
    ]);
  });
});
