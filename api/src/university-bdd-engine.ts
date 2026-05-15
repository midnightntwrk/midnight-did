import { assertTrustRoleActive, TRUST_ROLE_ISSUER } from "./trust-registry";
import {
  createTransportWithRetry,
  createUniversityTransport,
  resolveUniversityRuntimeMode,
} from "./university-bdd-transport";
import {
  type UniversityDiplomaCredential,
  type UniversityDiscountRequest,
  type UniversityDiscountStepResponse,
  type UniversityFixture,
  type UniversityIssuanceInvocation,
  type UniversityPresentationStepResponse,
  type UniversityScenarioResult,
  type UniversityScenarioStepLog,
  type UniversityTransport,
  type UniversityTransportFactoryByMode,
  type UniversityTransportMode,
  type UniversityTransportRetryOptions,
} from "./university-bdd-types";
import {
  assertIdentifiersExist,
  computeCredentialDigest,
  hashPayload,
  normalizeIdList,
  parseIso,
  toStepId,
} from "./university-bdd-utils";

const buildIssuanceProofAssertions = (
  issuedRequests: UniversityIssuanceInvocation[],
): { proofPlaceholders: string[]; didBindingChecks: string[] } => {
  if (issuedRequests.length === 0) {
    return {
      proofPlaceholders: ["issue-step:no-issuance-requests"],
      didBindingChecks: ["issue-step:no-issuance-requests"],
    };
  }

  const proofPlaceholders: string[] = [];
  const didBindingChecks: string[] = [];

  for (const issued of issuedRequests) {
    const baseLabel = `issue:${issued.studentId}`;
    if (!issued.response.issued || issued.response.credential == null) {
      proofPlaceholders.push(`${baseLabel}:proof-placeholder=issued=0`);
      didBindingChecks.push(
        `${baseLabel}:status=${issued.response.statusState}:rejected`,
      );
      continue;
    }

    const credentialWithoutProof = {
      ...issued.response.credential,
      proofDigest: "",
    };
    const credentialDigest = computeCredentialDigest(credentialWithoutProof);
    proofPlaceholders.push(
      `${baseLabel}:proof-placeholder=compact-eddsa:${issued.request.requestReference}`,
    );
    proofPlaceholders.push(
      `${baseLabel}:proof-binding=${credentialDigest.slice(0, 16)}`,
    );
    proofPlaceholders.push(
      `${baseLabel}:proof-placeholder-digest=${issued.response.credential.proofDigest}`,
    );
    didBindingChecks.push(
      `${baseLabel}:holder=${issued.response.credential.holderDid}:issuer=${issued.response.credential.issuerDid}`,
    );
  }

  return { proofPlaceholders, didBindingChecks };
};

const buildPresentationProofAssertions = (
  presentationResults: UniversityPresentationStepResponse["presentationResults"],
): { proofPlaceholders: string[]; didBindingChecks: string[] } => {
  if (presentationResults.length === 0) {
    return {
      proofPlaceholders: ["presentation-step:no-presentations"],
      didBindingChecks: ["presentation-step:no-presentations"],
    };
  }

  const proofPlaceholders: string[] = [];
  const didBindingChecks: string[] = [];

  for (const result of presentationResults) {
    proofPlaceholders.push(
      `presentation:${result.presentationId}:proof-placeholder=${result.credential.id}`,
    );
    proofPlaceholders.push(
      `presentation:${result.presentationId}:proof-placeholder:issued=${result.response.accepted ? "accepted" : "rejected"}`,
    );
    didBindingChecks.push(
      `presentation:${result.presentationId}:holder=${result.studentDid}:verifier=${result.verifierDid}:issuer=${result.credential.issuerDid}`,
    );
    didBindingChecks.push(
      `presentation:${result.presentationId}:credential-holder=${result.credential.holderDid}:student=${result.studentId}`,
    );
  }

  return { proofPlaceholders, didBindingChecks };
};

const timedStep = async <T>(
  label: string,
  payload: { request: unknown; involvedDids?: string[] },
  execute: () => Promise<T>,
  stepIndex: number,
): Promise<UniversityScenarioStepLog & { response: T }> => {
  const start = Date.now();
  const startedAt = new Date(start).toISOString();
  const requestId = hashPayload({
    index: stepIndex,
    label,
    request: payload.request,
  }).slice(0, 24);
  const response = await execute();
  const end = Date.now();
  const endedAt = new Date(end).toISOString();

  return {
    step: label,
    request: payload.request,
    response,
    involvedDids: payload.involvedDids ?? [],
    checks: [],
    stepId: toStepId(stepIndex, label),
    requestId,
    requestHash: hashPayload(payload.request),
    responseHash: hashPayload(response),
    latencyMs: end - start,
    startedAt,
    endedAt,
  };
};

export const runUniversityDiplomaScenario = async (
  fixture: UniversityFixture,
  options?: {
    mode?: UniversityTransportMode;
    transport?: UniversityTransport;
    transportFactories?: Partial<UniversityTransportFactoryByMode>;
    transportRetryOptions?: UniversityTransportRetryOptions;
    now?: string | Date;
    studentIds?: string[];
    companyIds?: string[];
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

  const mode = resolveUniversityRuntimeMode(
    options?.mode ?? process.env.UNIVERSITY_SCENARIO_MODE,
  );
  const transport =
    options?.transport ??
    createUniversityTransport(fixture, mode, {
      now,
      transportFactories: options?.transportFactories,
      retryOptions: options?.transportRetryOptions,
    });
  const transportWithRetry = createTransportWithRetry(
    transport,
    options?.transportRetryOptions,
  );
  const studentIds = normalizeIdList(options?.studentIds);
  const companyIds = normalizeIdList(options?.companyIds);

  assertIdentifiersExist(
    "studentId",
    studentIds,
    fixture.students,
    "studentId",
  );
  assertIdentifiersExist(
    "companyId",
    companyIds,
    fixture.companies,
    "companyId",
  );

  const activeStudents = studentIds
    ? fixture.students.filter((student) =>
        studentIds.includes(student.studentId),
      )
    : fixture.students;

  const activeCompanies = companyIds
    ? fixture.companies.filter((company) =>
        companyIds.includes(company.companyId),
      )
    : fixture.companies;

  if (activeStudents.length === 0) {
    throw new Error(
      "No students matched the provided studentIds filter. At least one valid student is required.",
    );
  }

  if (activeCompanies.length === 0) {
    throw new Error(
      "No companies matched the provided companyIds filter. At least one valid company is required.",
    );
  }

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
      0,
    ),
  );

  const issuanceMetricsBefore = transportWithRetry.snapshot();
  const issuanceStep = await timedStep(
    "Issue diploma VC across batches",
    {
      request: {
        batchCount: fixture.issuanceBatches.length,
        studentIds: activeStudents.map((student) => student.studentId),
        companyIds: activeCompanies.map((company) => company.companyId),
      },
      involvedDids: [fixture.university.did],
    },
    async () => {
      const issuedByBatch: Array<{
        batchIndex: number;
        issued: string[];
        skipped: string[];
      }> = [];
      const issuedRequests: UniversityIssuanceInvocation[] = [];

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
          if (studentIds != null && !studentIds.includes(student.studentId)) {
            skipped.push(`${student.studentId}:filtered`);
            continue;
          }

          const statusRef = `urn:vc-status:midnight:university-diploma:2026:${student.studentId}`;
          const requestReference = `request:${fixture.university.did}:${student.studentId}`;

          const issueDecision = await transportWithRetry.transport.issueDiploma(
            {
              student,
              issuedAt: now,
              credentialStatusRef: fixture.university.credentialStatusRef,
              statusRef,
              studentId: student.studentId,
              studentDid: student.did,
              universityDid: fixture.university.did,
              requestReference,
            },
          );
          issuedRequests.push({
            studentId: student.studentId,
            batchIndex,
            batchPosition: issued.length,
            request: {
              student,
              issuedAt: now,
              credentialStatusRef: fixture.university.credentialStatusRef,
              statusRef,
              studentId: student.studentId,
              studentDid: student.did,
              universityDid: fixture.university.did,
              requestReference,
            },
            response: issueDecision,
          });

          if (issueDecision.issued && issueDecision.credential != null) {
            credentials.push(issueDecision.credential);
            issued.push(student.studentId);
          } else {
            skipped.push(`${student.studentId}:${issueDecision.statusState}`);
          }
        }

        issuedByBatch.push({
          batchIndex,
          issued,
          skipped,
        });
      }

      return {
        issuedByBatch,
        issuedRequests,
        totalIssued: credentials.length,
      };
    },
    1,
  );

  const issuanceTransportChecks = transportWithRetry.stepChecks(
    ["issueDiploma"],
    issuanceMetricsBefore,
  );
  const issuanceProofAssertions = buildIssuanceProofAssertions(
    issuanceStep.response.issuedRequests,
  );

  steps.push({
    ...issuanceStep,
    checks: [
      `Batch issuance executed: ${issuanceStep.response.totalIssued} total`,
      `Trusted issuer reference: ${fixture.university.did}`,
      ...issuanceTransportChecks,
    ],
    proofPlaceholders: issuanceProofAssertions.proofPlaceholders,
    didBindingChecks: issuanceProofAssertions.didBindingChecks,
    transportChecks: issuanceTransportChecks,
  });

  const applicationMetricsBefore = transportWithRetry.snapshot();
  const applicationSteps = await timedStep<UniversityPresentationStepResponse>(
    "Student-to-verifier presentation requests",
    {
      request: {
        verifierCount: activeCompanies.length,
      },
      involvedDids: [
        fixture.university.did,
        ...activeCompanies.map((company) => company.did),
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

        const company = activeCompanies[index % activeCompanies.length];
        const applicationId = `${credential.studentId}->${company.companyId}`;

        const response = await transportWithRetry.transport.requestPresentation(
          {
            student,
            credential,
            createdAt: now,
            presentationId: `presentation-${applicationId}`,
            applicationId,
            verifierDid: company.did,
            studentDid: credential.holderDid,
            credentialId: credential.id,
            threshold: company.verificationThreshold,
          },
        );

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
          createdAt: now,
          response,
          studentId: student.studentId,
          student,
          credential,
        });
      }

      return { presentationResults, accepted };
    },
    2,
  );
  const applicationTransportChecks = transportWithRetry.stepChecks(
    ["requestPresentation"],
    applicationMetricsBefore,
  );
  const presentationProofAssertions = buildPresentationProofAssertions(
    applicationSteps.response.presentationResults,
  );

  steps.push({
    ...applicationSteps,
    checks: [
      `Applications processed: ${applicationSteps.response.presentationResults.length}`,
      `Application approvals: ${applicationSteps.response.accepted}`,
      ...applicationTransportChecks,
    ],
    proofPlaceholders: presentationProofAssertions.proofPlaceholders,
    didBindingChecks: presentationProofAssertions.didBindingChecks,
    transportChecks: applicationTransportChecks,
  });

  const discountMetricsBefore = transportWithRetry.snapshot();
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

        const response = await transportWithRetry.transport.requestDiscount({
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
          student,
          credential,
          gradeThreshold: fixture.mall.gradeThreshold,
          createdAt: now,
        });
      }

      return {
        discountRequests,
        acceptedDiscounts,
      };
    },
    3,
  );
  const discountTransportChecks = transportWithRetry.stepChecks(
    ["requestDiscount"],
    discountMetricsBefore,
  );

  steps.push({
    ...discountStep,
    checks: [
      `Discount requests generated: ${discountStep.response.discountRequests.length}`,
      `Discount approvals: ${discountStep.response.acceptedDiscounts}`,
      ...discountTransportChecks,
    ],
    transportChecks: discountTransportChecks,
  });

  const totalLatencyMs = steps.reduce(
    (total, step) => total + step.latencyMs,
    0,
  );

  return {
    scenarioTitle: fixture.scenarioTitle,
    generatedAt: new Date().toISOString(),
    metadata: {
      mode,
      fixtureVersion: fixture.scenarioVersion,
      studentsTargeted: activeStudents.length,
      companiesTargeted: activeCompanies.length,
      totalStudents: fixture.students.length,
      totalCompanies: fixture.companies.length,
    },
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
