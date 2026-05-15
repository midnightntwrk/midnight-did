import {
  assertTrustRoleActive,
  evaluateTrustRole,
  TRUST_ROLE_ISSUER,
  TRUST_ROLE_VERIFIER,
} from "./trust-registry";
import { computeCredentialDigest } from "./university-bdd-fixtures";
import {
  type UniversityDiplomaCredential,
  type UniversityDiscountRequest,
  type UniversityDiscountRequestContext,
  type UniversityDiscountResponse,
  type UniversityDiscountStepResponse,
  type UniversityFixture,
  type UniversityIssuanceDecision,
  type UniversityIssuanceInvocation,
  type UniversityIssuanceRequestContext,
  type UniversityPresentationDecision,
  type UniversityPresentationRequestContext,
  type UniversityPresentationStepResponse,
  type UniversityScenarioResult,
  type UniversityScenarioStepLog,
  type UniversityTransport,
  type UniversityTransportFactoryByMode,
  type UniversityTransportMode,
  type UniversityTransportOperationMetrics,
  type UniversityTransportRetryOptions,
} from "./university-bdd-types";
import {
  assertIdentifiersExist,
  hashPayload,
  normalizeIdList,
  parseIso,
  toStepId,
  waitMs,
} from "./university-bdd-utils";
import { evaluateVcStatus, type VerifiableCredential } from "./vc-status";

type TransportOperationName =
  | "issueDiploma"
  | "requestPresentation"
  | "requestDiscount";

type UniversityTransportOperationSnapshot = Record<
  TransportOperationName,
  UniversityTransportOperationMetrics
>;

const createTransportOperationBaseline =
  (): UniversityTransportOperationSnapshot => ({
    issueDiploma: {
      operation: "issueDiploma",
      attempts: 0,
      retries: 0,
      timeoutEvents: 0,
    },
    requestPresentation: {
      operation: "requestPresentation",
      attempts: 0,
      retries: 0,
      timeoutEvents: 0,
    },
    requestDiscount: {
      operation: "requestDiscount",
      attempts: 0,
      retries: 0,
      timeoutEvents: 0,
    },
  });

const cloneTransportMetrics = (source: {
  [K in TransportOperationName]: UniversityTransportOperationMetrics;
}): {
  [K in TransportOperationName]: UniversityTransportOperationMetrics;
} => ({
  issueDiploma: { ...source.issueDiploma },
  requestPresentation: { ...source.requestPresentation },
  requestDiscount: { ...source.requestDiscount },
});

const parseTransportRetryOptions = (
  options?: UniversityTransportRetryOptions,
): Required<UniversityTransportRetryOptions> => ({
  maxRetries: Math.max(
    0,
    Number.isFinite(Number(options?.maxRetries))
      ? Number(options?.maxRetries)
      : 0,
  ),
  timeoutMs: Math.max(
    0,
    Number.isFinite(Number(options?.timeoutMs))
      ? Number(options?.timeoutMs)
      : 0,
  ),
  retryDelayMs: Math.max(
    0,
    options?.retryDelayMs == null
      ? 0
      : Math.max(
          0,
          Number.isFinite(Number(options.retryDelayMs))
            ? Number(options.retryDelayMs)
            : 0,
        ),
  ),
});

const isTransportTimeoutError = (error: unknown): boolean => {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return true;
    }

    return /timeout/i.test(error.message);
  }

  return false;
};

const buildTransportStepChecks = (
  stepOperations: string[],
  baseline: UniversityTransportOperationSnapshot,
  current: UniversityTransportOperationSnapshot,
): string[] => {
  const lines: string[] = [];
  for (const operation of stepOperations) {
    if (
      operation !== "issueDiploma" &&
      operation !== "requestPresentation" &&
      operation !== "requestDiscount"
    ) {
      continue;
    }

    const baselineMetric = baseline[operation];
    const currentMetric = current[operation];
    const deltaAttempts = currentMetric.attempts - baselineMetric.attempts;
    const deltaRetries = currentMetric.retries - baselineMetric.retries;
    const deltaTimeouts =
      currentMetric.timeoutEvents - baselineMetric.timeoutEvents;

    if (deltaAttempts > 0 || deltaRetries > 0 || deltaTimeouts > 0) {
      lines.push(
        `Transport operation ${operation}: attempts=${deltaAttempts}, retries=${deltaRetries}, timeoutEvents=${deltaTimeouts}`,
      );
    }
  }

  if (lines.length === 0) {
    lines.push("Transport operations: no remote calls");
  }

  return lines;
};

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

const createTransportWithRetry = (
  transport: UniversityTransport,
  options?: UniversityTransportRetryOptions,
): {
  transport: UniversityTransport;
  snapshot: () => UniversityTransportOperationSnapshot;
  stepChecks: (
    operations: TransportOperationName[],
    baseline: UniversityTransportOperationSnapshot,
  ) => string[];
} => {
  const baseline = createTransportOperationBaseline();
  const retryOptions = parseTransportRetryOptions(options);

  const runWithTimeout = <T>(perform: () => T | Promise<T>): Promise<T> => {
    if (retryOptions.timeoutMs <= 0) {
      return Promise.resolve(perform());
    }

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const timeoutError = new Error(
          `Transport operation timed out after ${retryOptions.timeoutMs}ms`,
        );
        timeoutError.name = "AbortError";
        reject(timeoutError);
      }, retryOptions.timeoutMs);
      timeout.unref?.();

      Promise.resolve(perform())
        .then(resolve)
        .catch(reject)
        .finally(() => {
          clearTimeout(timeout);
        });
    });
  };

  const invokeWithRetry = async <Response>(
    operation: TransportOperationName,
    perform: () => Response | Promise<Response>,
  ): Promise<Response> => {
    const operationMetrics = baseline[operation];
    const maxAttempts = retryOptions.maxRetries + 1;
    let attempt = 0;

    while (true) {
      attempt += 1;
      if (attempt > 1) {
        operationMetrics.retries += 1;
      }
      operationMetrics.attempts += 1;
      const isLastAttempt = attempt >= maxAttempts;

      try {
        return await runWithTimeout(perform);
      } catch (error) {
        if (isTransportTimeoutError(error)) {
          operationMetrics.timeoutEvents += 1;
        }

        if (!isLastAttempt && isTransportTimeoutError(error)) {
          await waitMs(retryOptions.retryDelayMs);
          continue;
        }

        throw error;
      }
    }
  };

  const snapshot = () => cloneTransportMetrics(baseline);
  const stepChecks = (
    operations: TransportOperationName[],
    before: UniversityTransportOperationSnapshot,
  ) => buildTransportStepChecks(operations, before, baseline);

  return {
    transport: {
      issueDiploma(request: UniversityIssuanceRequestContext) {
        return invokeWithRetry("issueDiploma", () =>
          transport.issueDiploma(request),
        );
      },
      requestPresentation(request: UniversityPresentationRequestContext) {
        return invokeWithRetry("requestPresentation", () =>
          transport.requestPresentation(request),
        );
      },
      requestDiscount(request: UniversityDiscountRequestContext) {
        return invokeWithRetry("requestDiscount", () =>
          transport.requestDiscount(request),
        );
      },
    },
    snapshot,
    stepChecks,
  };
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

const toVerifiableCredential = (
  credential: UniversityDiplomaCredential,
): VerifiableCredential => {
  return {
    id: credential.id,
    credentialStatus: credential.credentialStatus,
  };
};

export const resolveUniversityRuntimeMode = (
  mode?: string,
): UniversityTransportMode => {
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

export const createUniversityTransportFactories =
  (): UniversityTransportFactoryByMode => {
    return {
      simulator: (fixture, { mode, now }) => {
        void mode;
        void now;
        return createUniversitySimulatorTransport(fixture);
      },
      standalone: () => createUniversityStandaloneTransport(),
    };
  };

export const createUniversityTransport = (
  fixture: UniversityFixture,
  mode: UniversityTransportMode,
  options?: {
    transportFactories?: Partial<UniversityTransportFactoryByMode>;
    retryOptions?: UniversityTransportRetryOptions;
    now?: string;
  },
): UniversityTransport => {
  const now = options?.now ?? new Date().toISOString();
  const factories = {
    ...createUniversityTransportFactories(),
    ...options?.transportFactories,
  };
  const selectedFactory = factories[mode];
  if (selectedFactory == null) {
    throw new Error(`No transport factory registered for mode: ${mode}`);
  }

  return selectedFactory(fixture, {
    fixture,
    mode,
    now,
    retryOptions: options?.retryOptions,
  });
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
