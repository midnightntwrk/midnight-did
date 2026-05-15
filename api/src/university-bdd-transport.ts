import { evaluateTrustRole, TRUST_ROLE_VERIFIER } from "./trust-registry";
import {
  type UniversityDiplomaCredential,
  type UniversityDiscountRequestContext,
  type UniversityDiscountResponse,
  type UniversityFixture,
  type UniversityIssuanceDecision,
  type UniversityIssuanceRequestContext,
  type UniversityPresentationDecision,
  type UniversityPresentationRequestContext,
  type UniversityTransport,
  type UniversityTransportFactoryByMode,
  type UniversityTransportMode,
  type UniversityTransportOperationMetrics,
  type UniversityTransportRetryOptions,
} from "./university-bdd-types";
import { computeCredentialDigest, waitMs } from "./university-bdd-utils";
import { evaluateVcStatus, type VerifiableCredential } from "./vc-status";

export type UniversityTransportOperationName =
  | "issueDiploma"
  | "requestPresentation"
  | "requestDiscount";

export type UniversityTransportOperationSnapshot = Record<
  UniversityTransportOperationName,
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
  [K in UniversityTransportOperationName]: UniversityTransportOperationMetrics;
}): {
  [K in UniversityTransportOperationName]: UniversityTransportOperationMetrics;
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
  retryDelayMs:
    options?.retryDelayMs == null
      ? 0
      : Math.max(
          0,
          Number.isFinite(Number(options.retryDelayMs))
            ? Number(options.retryDelayMs)
            : 0,
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

export const createTransportWithRetry = (
  transport: UniversityTransport,
  options?: UniversityTransportRetryOptions,
): {
  transport: UniversityTransport;
  snapshot: () => UniversityTransportOperationSnapshot;
  stepChecks: (
    operations: UniversityTransportOperationName[],
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
    operation: UniversityTransportOperationName,
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
    operations: UniversityTransportOperationName[],
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
