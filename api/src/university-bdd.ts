import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertTrustRoleActive,
  evaluateTrustRole,
  TRUST_ROLE_ISSUER,
  TRUST_ROLE_VERIFIER,
  type TrustRegistryState,
} from "./trust-registry";
import {
  evaluateVcStatus,
  type VcStatusReference,
  type VcStatusRegistry,
  type VerifiableCredential,
} from "./vc-status";

export const UNIVERSITY_DID_METHOD_PATTERN =
  /^did:midnight:[a-z0-9][a-z0-9._-]*:.+$/;

export type UniversityRole =
  | "student"
  | "university"
  | "verifier"
  | "discount-provider";

export type UniversityEntity = {
  did: string;
  name: string;
  role?: UniversityRole;
};

export type UniversityFixtureUniversity = UniversityEntity & {
  issuerDid: string;
  credentialStatusRef: string;
};

export type UniversityFixtureStudent = UniversityEntity & {
  studentId: string;
  fullName: string;
  program: string;
  graduationTerm: string;
  grade: number;
};

export type UniversityFixtureCompany = UniversityEntity & {
  companyId: string;
  verificationThreshold: number;
  endpoint: string;
};

export type UniversityFixtureMall = UniversityEntity & {
  discountPercent: number;
  gradeThreshold: number;
  endpoint: string;
};

export type UniversityFixture = {
  scenarioVersion: string;
  scenarioTitle: string;
  createdAt: string;
  university: UniversityFixtureUniversity;
  students: UniversityFixtureStudent[];
  companies: UniversityFixtureCompany[];
  mall: UniversityFixtureMall;
  issuanceBatches: string[][];
  statusRegistry: VcStatusRegistry;
  trustRegistry: TrustRegistryState;
};

export type UniversityIssuanceRequest = {
  studentId: string;
  studentDid: string;
  universityDid: string;
  requestReference: string;
};

export type UniversityIssuanceRequestContext = UniversityIssuanceRequest & {
  student: UniversityFixtureStudent;
  issuedAt: string;
  credentialStatusRef: string;
  statusRef: string;
};

export type UniversityDiplomaCredential = {
  id: string;
  studentId: string;
  holderDid: string;
  issuerDid: string;
  issuedAt: string;
  graduationTerm: string;
  grade: number;
  program: string;
  credentialStatus: VcStatusReference;
  proofDigest: string;
};

export type UniversityIssuanceDecision = {
  issued: boolean;
  credential?: UniversityDiplomaCredential;
  statusState: string;
  statusReason: string;
};

export type UniversityPresentationRequest = {
  presentationId: string;
  applicationId: string;
  verifierDid: string;
  studentDid: string;
  credentialId: string;
  threshold: number;
};

export type UniversityPresentationRequestContext =
  UniversityPresentationRequest & {
    student: UniversityFixtureStudent;
    credential: UniversityDiplomaCredential;
    createdAt: string;
  };

export type UniversityPresentationResponse = {
  accepted: boolean;
  reasons: string[];
};

export type UniversityPresentationDecision = UniversityPresentationResponse & {
  issuerCheck: string;
};

export type UniversityDiscountRequest = {
  offerId: string;
  mallDid: string;
  studentDid: string;
  credentialId: string;
  grade: number;
  couponPercent: number;
};

export type UniversityDiscountRequestContext = UniversityDiscountRequest & {
  student: UniversityFixtureStudent;
  credential: UniversityDiplomaCredential;
  gradeThreshold: number;
  createdAt: string;
};

export type UniversityDiscountResponse = {
  accepted: boolean;
  reasons: string[];
};

type UniversityPresentationStepResponse = {
  presentationResults: Array<
    UniversityPresentationRequest & {
      response: UniversityPresentationDecision;
      studentId: string;
    }
  >;
  accepted: number;
};

type UniversityDiscountStepResponse = {
  discountRequests: Array<
    UniversityDiscountRequest & {
      response: UniversityDiscountResponse;
      studentId: string;
    }
  >;
  acceptedDiscounts: number;
};

export type UniversityScenarioStepLog = {
  step: string;
  request: unknown;
  response: unknown;
  checks: string[];
  involvedDids: string[];
  latencyMs: number;
};

export type UniversityScenarioResult = {
  scenarioTitle: string;
  generatedAt: string;
  timing: {
    totalSteps: number;
    totalLatencyMs: number;
    avgLatencyMs: number;
  };
  steps: UniversityScenarioStepLog[];
  issuedCount: number;
  applicationCount: number;
  discountCount: number;
  approvedApplications: number;
  approvedDiscounts: number;
  credentials: UniversityDiplomaCredential[];
};

export type UniversityRuntimeMode = "simulator" | "standalone";

type UniversityTransport = {
  issueDiploma(
    request: UniversityIssuanceRequestContext,
  ): Promise<UniversityIssuanceDecision>;
  requestPresentation(
    request: UniversityPresentationRequestContext,
  ): Promise<UniversityPresentationDecision>;
  requestDiscount(
    request: UniversityDiscountRequestContext,
  ): Promise<UniversityDiscountResponse>;
};

const parseIso = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }
  return parsed.toISOString();
};

const canonicalStringify = (value: unknown): string => {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(normalize);
    }
    if (input != null && typeof input === "object") {
      return Object.entries(input)
        .sort(([lhs], [rhs]) => lhs.localeCompare(rhs))
        .reduce<Record<string, unknown>>((acc, [key, nested]) => {
          acc[key] = normalize(nested);
          return acc;
        }, {});
    }
    return input;
  };

  return JSON.stringify(normalize(value));
};

export const computeCredentialDigest = (
  credential: Omit<UniversityDiplomaCredential, "proofDigest">,
): string => {
  return createHash("sha256")
    .update(canonicalStringify(credential), "utf8")
    .digest("hex");
};

export const universityScenarioFixturePath = (filename: string): string => {
  return path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "test/fixtures/university-diploma",
    filename,
  );
};

export const loadUniversityScenarioFromFile = (
  fixturePath: string,
): UniversityFixture => {
  if (!existsSync(fixturePath)) {
    throw new Error(`University fixture not found: ${fixturePath}`);
  }

  const raw = readFileSync(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as UniversityFixture;

  if (typeof fixture.scenarioVersion !== "string") {
    throw new Error(
      `Invalid university fixture format: missing scenarioVersion`,
    );
  }

  if (!Array.isArray(fixture.students) || fixture.students.length === 0) {
    throw new Error(`Invalid university fixture format: students missing`);
  }

  if (!Array.isArray(fixture.companies) || fixture.companies.length === 0) {
    throw new Error(`Invalid university fixture format: companies missing`);
  }

  if (
    fixture.university == null ||
    !UNIVERSITY_DID_METHOD_PATTERN.test(fixture.university.did)
  ) {
    throw new Error(`Invalid university fixture format: university.did`);
  }

  return {
    ...fixture,
    createdAt: parseIso(fixture.createdAt),
  };
};

const timedStep = async <T>(
  label: string,
  payload: { request: unknown; involvedDids?: string[] },
  execute: () => Promise<T>,
): Promise<UniversityScenarioStepLog & { response: T }> => {
  const start = Date.now();
  const response = await execute();
  return {
    step: label,
    request: payload.request,
    response,
    involvedDids: payload.involvedDids ?? [],
    checks: [],
    latencyMs: Date.now() - start,
  };
};

const toVerifiableCredential = (
  credential: UniversityDiplomaCredential,
): VerifiableCredential => {
  return {
    id: credential.id,
    credentialStatus: credential.credentialStatus,
  };
};

const resolveRuntimeMode = (mode?: string): UniversityRuntimeMode => {
  if (mode === "standalone" || mode === "simulator") {
    return mode;
  }
  return "simulator";
};

const createUniversitySimulatorTransport = (
  fixture: UniversityFixture,
): UniversityTransport => {
  return {
    async issueDiploma(
      request: UniversityIssuanceRequestContext,
    ): Promise<UniversityIssuanceDecision> {
      const credential: UniversityDiplomaCredential = {
        id: `${request.universityDid}:vc:${request.studentId}:diploma`,
        studentId: request.student.studentId,
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
        proofDigest: "",
      };

      const digest = computeCredentialDigest(credential);
      const signed = {
        ...credential,
        proofDigest: digest,
      };
      const statusDecision = evaluateVcStatus(
        toVerifiableCredential(signed),
        fixture.statusRegistry,
      );

      if (statusDecision.state !== "active") {
        return {
          issued: false,
          statusState: statusDecision.state,
          statusReason: statusDecision.reason,
        };
      }

      return {
        issued: true,
        credential: signed,
        statusState: statusDecision.state,
        statusReason: statusDecision.reason,
      };
    },

    async requestPresentation(
      request: UniversityPresentationRequestContext,
    ): Promise<UniversityPresentationDecision> {
      const verifierDecision = evaluateTrustRole(
        fixture.trustRegistry,
        {
          role: TRUST_ROLE_VERIFIER,
          partyDid: request.verifierDid,
        },
        request.createdAt,
      );

      const statusDecision = evaluateVcStatus(
        toVerifiableCredential(request.credential),
        fixture.statusRegistry,
      );

      const reasons: string[] = [
        `Verifier role active: ${verifierDecision.isActive ? "yes" : "no"}`,
      ];

      if (request.student.grade >= request.threshold) {
        reasons.push("grade above threshold");
      } else {
        reasons.push("grade below threshold");
      }

      reasons.push(`status=${statusDecision.state}`);

      const accepted =
        verifierDecision.isActive &&
        statusDecision.state === "active" &&
        request.student.grade >= request.threshold;

      return {
        accepted,
        reasons,
        issuerCheck: verifierDecision.reason,
      };
    },

    async requestDiscount(
      request: UniversityDiscountRequestContext,
    ): Promise<UniversityDiscountResponse> {
      const statusDecision = evaluateVcStatus(
        toVerifiableCredential(request.credential),
        fixture.statusRegistry,
      );

      const accepted =
        request.grade > request.gradeThreshold &&
        statusDecision.state === "active";

      const reasons: string[] = [
        `grade(${request.grade}) > threshold(${request.gradeThreshold})`,
        `status=${statusDecision.state}`,
      ];
      if (!accepted) {
        reasons.push("request rejected by mall policy");
      }

      return {
        accepted,
        reasons,
      };
    },
  };
};

const createUniversityStandaloneTransport = (): UniversityTransport => {
  const notImplemented = async (): Promise<never> => {
    throw new Error(
      "Standalone transport is not implemented yet. Use UNIVERSITY_SCENARIO_MODE=simulator until production transport is wired.",
    );
  };

  return {
    issueDiploma: notImplemented,
    requestPresentation: notImplemented,
    requestDiscount: notImplemented,
  };
};

const createUniversityTransport = (
  fixture: UniversityFixture,
  mode: UniversityRuntimeMode,
): UniversityTransport => {
  if (mode === "standalone") {
    return createUniversityStandaloneTransport();
  }
  return createUniversitySimulatorTransport(fixture);
};

export const runUniversityDiplomaScenario = async (
  fixture: UniversityFixture,
  options?: {
    mode?: UniversityRuntimeMode;
    transport?: UniversityTransport;
    now?: string | Date;
  },
): Promise<UniversityScenarioResult> => {
  const steps: UniversityScenarioStepLog[] = [];
  const now = parseIso(
    options?.now == null
      ? fixture.createdAt
      : typeof options.now === "string"
        ? options.now
        : options.now.toISOString(),
  );

  const mode = resolveRuntimeMode(
    options?.mode ?? process.env.UNIVERSITY_SCENARIO_MODE,
  );
  const transport =
    options?.transport ?? createUniversityTransport(fixture, mode);

  assertTrustRoleActive(
    fixture.trustRegistry,
    {
      role: TRUST_ROLE_ISSUER,
      partyDid: fixture.university.did,
    },
    now,
  );

  const studentIndex = new Map(
    fixture.students.map((student) => [student.studentId, student]),
  );
  const credentials: UniversityDiplomaCredential[] = [];

  steps.push(
    await timedStep(
      "Load graduating class and trust context",
      {
        request: {
          scenarioVersion: fixture.scenarioVersion,
          totalStudents: fixture.students.length,
          universityDid: fixture.university.did,
          companyCount: fixture.companies.length,
        },
      },
      async () => {
        const checks = [
          "University issued as trusted issuer",
          `Student count loaded: ${fixture.students.length}`,
        ];

        return {
          scenarioTitle: fixture.scenarioTitle,
          checks,
        };
      },
    ),
  );

  const issuanceStep = await timedStep(
    "Issue diploma VC across batches",
    {
      request: {
        batchCount: fixture.issuanceBatches.length,
        studentIds: fixture.issuanceBatches.flat(),
      },
      involvedDids: [fixture.university.did],
    },
    async () => {
      const issuedByBatch: Array<{
        batchIndex: number;
        issued: string[];
        skipped: string[];
      }> = [];

      for (
        let batchIndex = 0;
        batchIndex < fixture.issuanceBatches.length;
        batchIndex++
      ) {
        const batch = fixture.issuanceBatches[batchIndex];
        const issued: string[] = [];
        const skipped: string[] = [];

        for (const studentId of batch) {
          const student = studentIndex.get(studentId);
          if (student == null) {
            skipped.push(`${studentId}:not-found`);
            continue;
          }

          const statusRef = `urn:vc-status:midnight:university-diploma:2026:${student.studentId}`;
          const requestReference = `request:${fixture.university.did}:${student.studentId}`;

          const issueDecision = await transport.issueDiploma({
            student,
            issuedAt: now,
            credentialStatusRef: fixture.university.credentialStatusRef,
            statusRef,
            studentId: student.studentId,
            studentDid: student.did,
            universityDid: fixture.university.did,
            requestReference,
          });

          if (issueDecision.issued && issueDecision.credential != null) {
            credentials.push(issueDecision.credential);
            issued.push(student.studentId);
            continue;
          }

          skipped.push(`${student.studentId}:${issueDecision.statusState}`);
        }

        issuedByBatch.push({
          batchIndex,
          issued,
          skipped,
        });
      }

      return {
        issuedByBatch,
        totalIssued: credentials.length,
      };
    },
  );

  steps.push({
    ...issuanceStep,
    checks: [
      `Batch issuance executed: ${issuanceStep.response.totalIssued} total`,
      `Trusted issuer reference: ${fixture.university.did}`,
    ],
  });

  const applicationSteps = await timedStep<UniversityPresentationStepResponse>(
    "Student-to-verifier presentation requests",
    {
      request: {
        verifierCount: fixture.companies.length,
      },
      involvedDids: [
        fixture.university.did,
        ...fixture.companies.map((company) => company.did),
      ],
    },
    async () => {
      const presentationResults: UniversityPresentationStepResponse["presentationResults"] =
        [];
      let accepted = 0;

      for (const [index, credential] of credentials.entries()) {
        const student = fixture.students.find(
          ({ did }) => did === credential.holderDid,
        );
        if (student == null) {
          continue;
        }

        const company = fixture.companies[index % fixture.companies.length];
        const applicationId = `${credential.studentId}->${company.companyId}`;

        const response = await transport.requestPresentation({
          student,
          credential,
          createdAt: now,
          presentationId: `presentation-${applicationId}`,
          applicationId,
          verifierDid: company.did,
          studentDid: credential.holderDid,
          credentialId: credential.id,
          threshold: company.verificationThreshold,
        });

        if (response.accepted) {
          accepted += 1;
        }

        presentationResults.push({
          presentationId: `presentation-${applicationId}`,
          applicationId,
          verifierDid: company.did,
          studentDid: credential.holderDid,
          credentialId: credential.id,
          threshold: company.verificationThreshold,
          response,
          studentId: student.studentId,
        });
      }

      return { presentationResults, accepted };
    },
  );

  steps.push({
    ...applicationSteps,
    checks: [
      `Applications processed: ${applicationSteps.response.presentationResults.length}`,
      `Application approvals: ${applicationSteps.response.accepted}`,
    ],
  });

  const discountStep = await timedStep<UniversityDiscountStepResponse>(
    "Student-to-mall discount presentations",
    {
      request: {
        mallDid: fixture.mall.did,
        gradeThreshold: fixture.mall.gradeThreshold,
      },
      involvedDids: [fixture.mall.did],
    },
    async () => {
      const discountRequests: UniversityDiscountStepResponse["discountRequests"] =
        [];

      let acceptedDiscounts = 0;
      for (const credential of credentials) {
        const student = fixture.students.find(
          ({ did }) => did === credential.holderDid,
        );
        if (student == null) {
          continue;
        }

        if (student.grade <= fixture.mall.gradeThreshold) {
          continue;
        }

        const request: UniversityDiscountRequest = {
          offerId: `discount-${student.studentId}`,
          mallDid: fixture.mall.did,
          studentDid: student.did,
          credentialId: credential.id,
          grade: student.grade,
          couponPercent: fixture.mall.discountPercent,
        };

        const response = await transport.requestDiscount({
          student,
          credential,
          gradeThreshold: fixture.mall.gradeThreshold,
          createdAt: now,
          ...request,
        });
        acceptedDiscounts += response.accepted ? 1 : 0;

        discountRequests.push({
          ...request,
          response,
          studentId: student.studentId,
        });
      }

      return {
        discountRequests,
        acceptedDiscounts,
      };
    },
  );

  steps.push({
    ...discountStep,
    checks: [
      `Discount requests generated: ${discountStep.response.discountRequests.length}`,
      `Discount approvals: ${discountStep.response.acceptedDiscounts}`,
    ],
  });

  const totalLatencyMs = steps.reduce(
    (total, step) => total + step.latencyMs,
    0,
  );

  return {
    scenarioTitle: fixture.scenarioTitle,
    generatedAt: new Date().toISOString(),
    timing: {
      totalSteps: steps.length,
      totalLatencyMs,
      avgLatencyMs: Math.round(totalLatencyMs / Math.max(steps.length, 1)),
    },
    steps,
    issuedCount: credentials.length,
    applicationCount: applicationSteps.response.presentationResults.length,
    discountCount: discountStep.response.discountRequests.length,
    approvedApplications: applicationSteps.response.accepted,
    approvedDiscounts: discountStep.response.acceptedDiscounts,
    credentials,
  };
};

export const formatUniversityScenarioNotes = (
  report: UniversityScenarioResult,
): string => {
  return report.steps
    .map((step) => {
      return [
        `Step: ${step.step}`,
        `Request: ${JSON.stringify(step.request, null, 2)}`,
        `Response: ${JSON.stringify(step.response, null, 2)}`,
        `Checks: ${JSON.stringify(step.checks, null, 2)}`,
      ].join("\n");
    })
    .join("\n\n");
};
