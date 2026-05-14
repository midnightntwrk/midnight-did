import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  type UniversityFixture,
  collectUniversityPartySamples,
  deriveUniversityFixtureSubset,
  formatUniversityScenarioNotes,
  loadUniversityScenarioFromFile,
  runUniversityDiplomaScenario,
  summarizeUniversityScenario,
  toUniversityScenarioArtifact,
  toUniversityScenarioReplayArtifact,
  type UniversityIssuanceRequestContext,
  universityScenarioFixturePath,
  type UniversityScenarioResult,
  type UniversityTransport,
} from "../university-bdd";

describe("University diploma BDD scenario", () => {
  const fixturePath = universityScenarioFixturePath(
    "university-bdd.fixture.json",
  );

  const cloneFixture = (): UniversityFixture => {
    return structuredClone(loadUniversityScenarioFromFile(fixturePath));
  };

  const revokedStudentStatusRef = (
    fixture: UniversityFixture,
    studentId: string,
  ): string => `${fixture.statusRegistry.statusRef}:${studentId}`;

  const fixtureWithRevokedStudent = (studentId: string): UniversityFixture => {
    const fixture = cloneFixture();
    const statusRef = revokedStudentStatusRef(fixture, studentId);
    const credentialStatus = fixture.statusRegistry.credentials[statusRef];
    if (credentialStatus == null) {
      throw new Error(`Missing status entry for ${studentId}`);
    }

    return {
      ...fixture,
      statusRegistry: {
        ...fixture.statusRegistry,
        credentials: {
          ...fixture.statusRegistry.credentials,
          [statusRef]: {
            ...credentialStatus,
            state: "revoked",
            statusReason: "simulated revocation",
          },
        },
      },
    };
  };

  const fixtureWithRevokedRole = (
    role: "issuer" | "verifier",
    partyDid: string,
    effectiveAt: string,
  ): UniversityFixture => {
    const fixture = cloneFixture();
    return {
      ...fixture,
      trustRegistry: {
        ...fixture.trustRegistry,
        events: [
          ...fixture.trustRegistry.events,
          {
            role,
            partyDid,
            actorDid: fixture.university.did,
            action: "revoke",
            effectiveAt,
            reason: "Trust role revoked",
          },
        ],
      },
    };
  };

  const loadResult = async (): Promise<UniversityScenarioResult> => {
    const fixture = loadUniversityScenarioFromFile(fixturePath);
    return runUniversityDiplomaScenario(fixture);
  };

  const createMockStandaloneTransport = (
    calls: { method: string; request: unknown }[],
  ): UniversityTransport => {
    const createCredential = (request: UniversityIssuanceRequestContext) => ({
      id: `${request.universityDid}:vc:${request.studentId}:contract-test`,
      studentId: request.studentId,
      holderDid: request.studentDid,
      issuerDid: request.universityDid,
      issuedAt: request.issuedAt,
      graduationTerm: request.student.graduationTerm,
      grade: request.student.grade,
      program: request.student.program,
      credentialStatus: {
        id: request.credentialStatusRef,
        type: "MidnightStatusList",
        statusPurpose: "revocation",
        statusRef: request.statusRef,
      },
      proofDigest: `contract-${request.requestReference}`,
    });

    return {
      async issueDiploma(request) {
        calls.push({ method: "issueDiploma", request });
        const credential = createCredential(request);
        return {
          issued: true,
          credential,
          statusState: "active",
          statusReason: "contract adapter active",
        };
      },
      async requestPresentation(request) {
        calls.push({ method: "requestPresentation", request });
        const accepted = request.student.grade > request.threshold;
        return {
          accepted,
          reasons: [
            `student=${request.student.studentId}`,
            `threshold=${request.threshold}`,
          ],
          issuerCheck: "mock-verifier-active",
        };
      },
      async requestDiscount(request) {
        calls.push({ method: "requestDiscount", request });
        const accepted = request.grade > request.gradeThreshold;
        return {
          accepted,
          reasons: [
            `student=${request.student.studentId}`,
            `grade=${request.grade}`,
            `threshold=${request.gradeThreshold}`,
          ],
        };
      },
    };
  };

  const fixtureSamplesPath = universityScenarioFixturePath(
    "university-bdd.party-samples.fixture.json",
  );

  it("runs deterministic issuance, presentation, and discount steps", async () => {
    const result = await loadResult();

    const issueStep = result.steps.find(
      (step) => step.step === "Issue diploma VC across batches",
    );
    const applicationStep = result.steps.find(
      (step) => step.step === "Student-to-verifier presentation requests",
    );
    const discountStep = result.steps.find(
      (step) => step.step === "Student-to-mall discount presentations",
    );

    expect(issueStep).toBeDefined();
    expect(applicationStep).toBeDefined();
    expect(discountStep).toBeDefined();

    expect(result.issuedCount).toBe(10);
    expect(result.applicationCount).toBe(10);
    expect(result.discountCount).toBe(5);
    expect(result.approvedApplications).toBe(9);
    expect(result.approvedDiscounts).toBe(5);
    expect(result.timing.totalSteps).toBe(4);
    expect(issueStep?.response).toMatchObject({
      totalIssued: 10,
    });
    expect(applicationStep?.response).toMatchObject({
      accepted: 9,
    });
    expect(discountStep?.response).toMatchObject({
      acceptedDiscounts: 5,
    });

    const notes = formatUniversityScenarioNotes(result);
    expect(notes).toContain('"batchCount": 3');
    expect(notes).toContain('"checks": [');
    expect(notes).toContain("Step: Issue diploma VC across batches");
  });

  it("defaults to simulator transport and surfaces standalone mode guard", async () => {
    const fixture = loadUniversityScenarioFromFile(fixturePath);
    const result = await runUniversityDiplomaScenario(fixture, {
      mode: "simulator",
    });

    expect(result.applicationCount).toBe(10);

    await expect(
      runUniversityDiplomaScenario(fixture, { mode: "standalone" }),
    ).rejects.toThrow(/Standalone transport is not implemented yet/);
  });

  it("supports filtering by student and verifier/company ids", async () => {
    const fixture = loadUniversityScenarioFromFile(fixturePath);
    const result = await runUniversityDiplomaScenario(fixture, {
      studentIds: ["S002", "S004", "S009"],
      companyIds: ["C001", "C003"],
    });

    expect(result.issuedCount).toBe(3);
    expect(result.metadata.studentsTargeted).toBe(3);
    expect(result.metadata.companiesTargeted).toBe(2);
    expect(result.applicationCount).toBe(3);
    expect(result.discountCount).toBe(3);
    expect(result.approvedDiscounts).toBe(3);
  });

  it("derives deterministic fixture subsets for filtered actor slices", async () => {
    const fixture = loadUniversityScenarioFromFile(fixturePath);
    const filtered = deriveUniversityFixtureSubset(fixture, {
      studentIds: ["S002", "S001", "S002", "S009"],
      companyIds: ["C003", "C001"],
    });

    expect(filtered.students.map((student) => student.studentId)).toEqual([
      "S001",
      "S002",
      "S009",
    ]);
    expect(filtered.companies.map((company) => company.companyId)).toEqual([
      "C001",
      "C003",
    ]);
    expect(filtered.issuanceBatches).toEqual([["S001", "S002"], ["S009"]]);
    expect(filtered.scenarioTitle).toContain(
      "filtered studentIds=S002,S001,S009",
    );

    const baselineResult = await runUniversityDiplomaScenario(
      deriveUniversityFixtureSubset(fixture, {
        studentIds: ["S002", "S001", "S002", "S009"],
        companyIds: ["C003", "C001"],
      }),
    );
    const rerunResult = await runUniversityDiplomaScenario(
      deriveUniversityFixtureSubset(fixture, {
        studentIds: ["S001", "S002", "S009"],
        companyIds: ["C001", "C003"],
      }),
    );

    expect(baselineResult.metadata).toEqual(rerunResult.metadata);
    expect(baselineResult.issuedCount).toBe(rerunResult.issuedCount);
    expect(baselineResult.applicationCount).toBe(rerunResult.applicationCount);
    expect(baselineResult.discountCount).toBe(rerunResult.discountCount);
    expect(baselineResult.steps.map((step) => step.stepId)).toEqual(
      rerunResult.steps.map((step) => step.stepId),
    );
  });

  it("fails with actionable errors when unknown IDs are provided", async () => {
    const fixture = loadUniversityScenarioFromFile(fixturePath);

    await expect(
      runUniversityDiplomaScenario(fixture, {
        studentIds: ["student-missing-1"],
      }),
    ).rejects.toThrow(/Unknown studentId identifiers/);

    await expect(
      runUniversityDiplomaScenario(fixture, {
        companyIds: ["company-missing-1"],
      }),
    ).rejects.toThrow(/Unknown companyId identifiers/);
  });

  const artifacts = new Set<string>();
  afterEach(() => {
    for (const artifact of artifacts) {
      rmSync(artifact, { force: true });
    }
    artifacts.clear();
  });

  it("writes BDD scenario report artifact in deterministic pretty JSON", async () => {
    const result = await loadResult();
    const summary = summarizeUniversityScenario(result);
    const tempDir = mkdtempSync(join(tmpdir(), "university-bdd-"));
    const artifactPath = join(tempDir, "university-bdd-report.json");
    const reportPath = join(tempDir, "university-bdd-report.txt");
    artifacts.add(artifactPath);
    artifacts.add(reportPath);

    writeFileSync(reportPath, summary, "utf8");
    writeFileSync(
      artifactPath,
      JSON.stringify(toUniversityScenarioArtifact(result), null, 2),
      "utf8",
    );

    const parsed = JSON.parse(readFileSync(artifactPath, "utf8"));
    expect(parsed.scenarioTitle).toContain(
      "University Diploma Issuance and Presentation",
    );
    expect(parsed.approvedDiscounts).toBe(5);
    expect(parsed.metadata.mode).toBe("simulator");
    expect(parsed.steps.length).toBe(4);
    expect(parsed.timing.totalLatencyMs).toBeGreaterThanOrEqual(0);

    const notes = readFileSync(reportPath, "utf8");
    expect(notes).toContain("University BDD summary");
    expect(notes).toContain("Mode: simulator");
  });

  it("collects stable student-to-party request/response samples", async () => {
    const result = await loadResult();
    const samples = collectUniversityPartySamples(result);
    const fixtureSamples = JSON.parse(
      readFileSync(fixtureSamplesPath, "utf8"),
    ) as typeof samples;

    expect(samples.studentToUniversity).toHaveLength(10);
    expect(samples.studentToVerifier).toHaveLength(10);
    expect(samples.studentToMall).toHaveLength(5);
    expect(samples).toEqual(fixtureSamples);
  });

  it("supports standalone adapter wiring via injected transport", async () => {
    const fixture = loadUniversityScenarioFromFile(fixturePath);
    const calls: { method: string; request: unknown }[] = [];

    const result = await runUniversityDiplomaScenario(fixture, {
      mode: "standalone",
      transport: createMockStandaloneTransport(calls),
      studentIds: ["S002", "S004", "S007"],
      companyIds: ["C001", "C002"],
    });

    expect(result.issuedCount).toBe(3);
    expect(result.applicationCount).toBe(3);
    expect(result.discountCount).toBe(3);
    expect(result.approvedApplications).toBe(3);
    expect(result.approvedDiscounts).toBe(3);

    expect(
      calls.filter((entry) => entry.method === "issueDiploma"),
    ).toHaveLength(3);
    expect(
      calls.filter((entry) => entry.method === "requestPresentation"),
    ).toHaveLength(3);
    expect(
      calls.filter((entry) => entry.method === "requestDiscount"),
    ).toHaveLength(3);

    const firstIssue = calls.find((entry) => entry.method === "issueDiploma");
    const firstPresentation = calls.find(
      (entry) => entry.method === "requestPresentation",
    );
    const firstDiscount = calls.find(
      (entry) => entry.method === "requestDiscount",
    );

    expect(firstIssue).toBeDefined();
    expect(firstPresentation).toBeDefined();
    expect(firstDiscount).toBeDefined();
  });

  it("canonicalizes DIDs during fixture load and scenario execution", () => {
    const rawFixture = JSON.parse(
      readFileSync(fixturePath, "utf8"),
    ) as UniversityFixture;
    const fixtureWithUppercaseDids = {
      ...rawFixture,
      university: {
        ...rawFixture.university,
        did: "  DID:midnight:EDU:North-Edge-University  ",
        issuerDid: "did:midnight:KEY:UNIVERSITY-ISSUER",
      },
      students: rawFixture.students.map((student, index) =>
        index === 0
          ? { ...student, did: "  DID:MidNight:User:Student-First  " }
          : student,
      ),
      companies: rawFixture.companies.map((company, index) =>
        index === 0
          ? { ...company, did: "did:midnight:ORG:GreatCo" }
          : company,
      ),
      mall: {
        ...rawFixture.mall,
        did: "did:Midnight:org:Night-Mall",
      },
    };

    const fixtureTempDir = mkdtempSync(join(tmpdir(), "university-bdd-load-"));
    const mutatedFixturePath = join(fixtureTempDir, "university-bdd.json");
    writeFileSync(
      mutatedFixturePath,
      JSON.stringify(fixtureWithUppercaseDids, null, 2),
      "utf8",
    );

    const loaded = loadUniversityScenarioFromFile(mutatedFixturePath);

    expect(loaded.university.did).toBe("did:midnight:edu:north-edge-university");
    expect(loaded.university.issuerDid).toBe("did:midnight:key:university-issuer");
    expect(loaded.students[0].did).toBe("did:midnight:user:student-first");
    expect(loaded.companies[0].did).toBe("did:midnight:org:greatco");
    expect(loaded.mall.did).toBe("did:midnight:org:night-mall");

    rmSync(fixtureTempDir, { recursive: true, force: true });
  });

  it("validates malformed student and company records with field-level diagnostics", () => {
    const rawFixture = JSON.parse(
      readFileSync(fixturePath, "utf8"),
    ) as UniversityFixture;
    const malformedFixture = {
      ...rawFixture,
      students: [{ studentId: 123 }],
      companies: [{ companyId: "C001" }],
    };

    const fixtureTempDir = mkdtempSync(
      join(tmpdir(), "university-bdd-invalid-"),
    );
    const malformedFixturePath = join(fixtureTempDir, "malformed.json");
    writeFileSync(
      malformedFixturePath,
      JSON.stringify(malformedFixture, null, 2),
      "utf8",
    );

    expect(() => loadUniversityScenarioFromFile(malformedFixturePath)).toThrow(
      /students\[0\]\.did/,
    );

    rmSync(fixtureTempDir, { recursive: true, force: true });
  });

  it("validates invalid DID namespaces during fixture load", () => {
    const rawFixture = JSON.parse(
      readFileSync(fixturePath, "utf8"),
    ) as UniversityFixture;
    const malformedFixture = {
      ...rawFixture,
      students: rawFixture.students.map((student, index) =>
        index === 0
          ? { ...student, did: "did:midnight:org:student-001" }
          : student,
      ),
    };

    const fixtureTempDir = mkdtempSync(
      join(tmpdir(), "university-bdd-did-ns-"),
    );
    const malformedFixturePath = join(fixtureTempDir, "malformed.json");
    writeFileSync(
      malformedFixturePath,
      JSON.stringify(malformedFixture, null, 2),
      "utf8",
    );

    expect(() => loadUniversityScenarioFromFile(malformedFixturePath)).toThrow(
      /students\[0\]\.did namespace must be one of \[did:midnight:user\]/,
    );

    rmSync(fixtureTempDir, { recursive: true, force: true });
  });

  it("fails when issuer trust role is revoked before scenario execution", async () => {
    const fixture = cloneFixture();
    const revoked = fixtureWithRevokedRole(
      "issuer",
      fixture.university.did,
      "2026-05-14T01:00:00.000Z",
    );

    await expect(
      runUniversityDiplomaScenario(revoked, {
        now: "2026-05-14T02:00:00.000Z",
      }),
    ).rejects.toThrow(/Role not active: role=issuer/);
  });

  it("propagates revoked credential status as presentation and discount rejections", async () => {
    const fixture = fixtureWithRevokedStudent("S002");
    const result = await runUniversityDiplomaScenario(fixture);

    expect(result.issuedCount).toBe(9);
    expect(result.applicationCount).toBe(9);
    expect(result.discountCount).toBe(4);
    expect(result.approvedApplications).toBe(8);
    expect(result.approvedDiscounts).toBe(4);

    const samplePartyPairs = collectUniversityPartySamples(result);
    const presentedStudents = new Set(
      samplePartyPairs.studentToVerifier.map(
        ({ request }) => request.student.studentId,
      ),
    );

    expect(presentedStudents.has("S002")).toBe(false);
    expect(presentedStudents.has("S001")).toBe(true);
    expect(result.steps[2]?.response).toMatchObject({
      accepted: 8,
    });
  });

  it("fails all presentations when verifier trust role has expired while discounts stay active", async () => {
    const fixture = cloneFixture();
    const verifier = fixture.companies.find(
      ({ companyId }) => companyId === "C001",
    );
    if (verifier == null) {
      throw new Error("Missing company C001");
    }

    const revokedVerifier = fixtureWithRevokedRole(
      "verifier",
      verifier.did,
      "2026-05-14T01:00:00.000Z",
    );

    const result = await runUniversityDiplomaScenario(revokedVerifier, {
      companyIds: ["C001"],
      now: "2026-05-14T02:00:00.000Z",
    });

    expect(result.applicationCount).toBe(10);
    expect(result.approvedApplications).toBe(0);
    expect(result.discountCount).toBe(5);
    expect(result.approvedDiscounts).toBe(5);

    const presentationStep = result.steps.find(
      (step) => step.step === "Student-to-verifier presentation requests",
    );
    expect(presentationStep).toBeDefined();
    const presentationResponse = presentationStep?.response as
      | {
          presentationResults: Array<{
            response: { accepted: boolean; reasons: string[] };
          }>;
        }
      | undefined;
    expect(
      presentationResponse?.presentationResults.every(
        ({ response }) =>
          response.accepted === false &&
          response.reasons.includes("Verifier role active: no"),
      ),
    ).toBe(true);
  });

  it("exports replay-ready artifact with request IDs and hashes", async () => {
    const result = await loadResult();
    const replay = toUniversityScenarioReplayArtifact(result);

    expect(replay.steps).toHaveLength(4);
    expect(replay.steps.map((step) => step.stepId)).toEqual([
      "01-load-graduating-class-and-trust-context",
      "02-issue-diploma-vc-across-batches",
      "03-student-to-verifier-presentation-requests",
      "04-student-to-mall-discount-presentations",
    ]);

    const requestIds = replay.steps.map((step) => step.requestId);
    expect(new Set(requestIds).size).toBe(4);

    for (const step of replay.steps) {
      expect(step.requestHash).toMatch(/^[0-9a-f]{64}$/);
      expect(step.responseHash).toMatch(/^[0-9a-f]{64}$/);
      expect(Date.parse(step.startedAt)).toBeGreaterThanOrEqual(0);
      expect(Date.parse(step.endedAt)).toBeGreaterThanOrEqual(
        Date.parse(step.startedAt),
      );
    }
  });

  it("guards CI-critical metrics are monotonic and bounded", async () => {
    const result = await loadResult();
    const cumulativeLatencies = result.steps.reduce<number[]>(
      (acc, step) => {
        const previous = acc[acc.length - 1] ?? 0;
        acc.push(previous + step.latencyMs);
        return acc;
      },
      [0],
    );

    expect(result.timing.totalSteps).toBe(4);
    expect(result.timing.totalLatencyMs).toBe(cumulativeLatencies.at(-1));
    expect(result.timing.avgLatencyMs).toBe(
      Math.round(result.timing.totalLatencyMs / result.timing.totalSteps),
    );
    expect(result.timing.totalLatencyMs).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < cumulativeLatencies.length; i++) {
      expect(cumulativeLatencies[i]).toBeGreaterThanOrEqual(
        cumulativeLatencies[i - 1],
      );
    }

    expect(result.issuedCount).toBe(10);
    expect(result.applicationCount).toBe(result.issuedCount);
    expect(result.discountCount).toBe(5);
    expect(result.issuedCount).toBeGreaterThanOrEqual(
      result.approvedApplications,
    );
    expect(result.issuedCount).toBeGreaterThanOrEqual(result.discountCount);
    expect(result.applicationCount).toBeGreaterThanOrEqual(
      result.approvedApplications,
    );
    expect(result.discountCount).toBeGreaterThanOrEqual(
      result.approvedDiscounts,
    );
  });
});
