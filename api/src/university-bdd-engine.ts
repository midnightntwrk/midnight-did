import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertTrustRoleActive,
  evaluateTrustRole,
  TRUST_ROLE_ISSUER,
  TRUST_ROLE_PATTERN,
  TRUST_ROLE_VERIFIER,
  type TrustRegistryState,
  type TrustRole,
  type TrustRoleEvent,
  type TrustRoleGrant,
} from "./trust-registry";
import {
  UNIVERSITY_DID_METHOD_PATTERN,
  UNIVERSITY_DID_NAMESPACE_PREFIXES,
  UNIVERSITY_SCENARIO_REPLAY_ARTIFACT_VERSION,
  UNIVERSITY_SCENARIO_REPORT_ARTIFACT_VERSION,
  type UniversityDiplomaCredential,
  type UniversityDiscountRequest,
  type UniversityDiscountRequestContext,
  type UniversityDiscountResponse,
  type UniversityDiscountStepResponse,
  type UniversityFixture,
  type UniversityFixtureCompany,
  type UniversityFixtureGeneratorOptions,
  type UniversityFixtureMall,
  type UniversityFixtureShrinkOptions,
  type UniversityFixtureStudent,
  type UniversityFixtureSubsetOptions,
  type UniversityFixtureUniversity,
  type UniversityIssuanceDecision,
  type UniversityIssuanceInvocation,
  type UniversityIssuanceRequestContext,
  type UniversityIssuanceStepResponse,
  type UniversityPartySamples,
  type UniversityPresentationDecision,
  type UniversityPresentationRequestContext,
  type UniversityPresentationStepResponse,
  type UniversityRole,
  type UniversityScenarioReplayArtifact,
  type UniversityScenarioReportArtifact,
  type UniversityScenarioResult,
  type UniversityScenarioStepLog,
  type UniversityTransport,
  type UniversityTransportFactoryByMode,
  type UniversityTransportMode,
  type UniversityTransportOperationMetrics,
  type UniversityTransportRetryOptions,
} from "./university-bdd-types";
import {
  evaluateVcStatus,
  type VcStatusRegistry,
  type VerifiableCredential,
} from "./vc-status";

const assertPlainObject = (
  value: unknown,
  label: string,
): Record<string, unknown> => {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid university fixture format: ${label}`);
  }
  return value as Record<string, unknown>;
};

const assertRequiredString = (
  value: unknown,
  label: string,
  nonEmpty = true,
): string => {
  if (typeof value !== "string") {
    throw new Error(`Invalid university fixture format: ${label}`);
  }

  if (nonEmpty && value.trim() === "") {
    throw new Error(`Invalid university fixture format: ${label}`);
  }

  return value;
};

const assertRequiredNumber = (value: unknown, label: string): number => {
  if (
    typeof value !== "number" ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    throw new Error(`Invalid university fixture format: ${label}`);
  }
  return value;
};

const normalizeDid = (value: unknown, label: string): string => {
  const canonical = assertRequiredString(value, label).trim().toLowerCase();
  if (!UNIVERSITY_DID_METHOD_PATTERN.test(canonical)) {
    throw new Error(`Invalid university fixture format: ${label}`);
  }
  return canonical;
};

const didNamespace = (did: string): string =>
  did.split(":").slice(0, 3).join(":");

const assertDidNamespace = (
  did: string,
  label: string,
  allowed: ReadonlySet<string>,
): string => {
  const namespace = didNamespace(did);
  if (!allowed.has(namespace)) {
    throw new Error(
      `Invalid university fixture format: ${label} namespace must be one of [${[
        ...allowed,
      ].join(", ")}]`,
    );
  }
  return did;
};

const normalizeStudent = (
  student: unknown,
  index: number,
): UniversityFixtureStudent => {
  const raw = assertPlainObject(student, `students[${index}]`);
  return {
    did: assertDidNamespace(
      normalizeDid(raw.did, `students[${index}].did`),
      `students[${index}].did`,
      UNIVERSITY_DID_NAMESPACE_PREFIXES.student,
    ),
    studentId: assertRequiredString(
      raw.studentId,
      `students[${index}].studentId`,
    ),
    fullName: assertRequiredString(raw.fullName, `students[${index}].fullName`),
    program: assertRequiredString(raw.program, `students[${index}].program`),
    graduationTerm: assertRequiredString(
      raw.graduationTerm,
      `students[${index}].graduationTerm`,
    ),
    grade: assertRequiredNumber(raw.grade, `students[${index}].grade`),
    name:
      raw.name == null
        ? undefined
        : assertRequiredString(raw.name, `students[${index}].name`),
    role: (typeof raw.role === "string" ? raw.role : undefined) as
      | UniversityRole
      | undefined,
  };
};

const normalizeTrustRole = (value: unknown, label: string): TrustRole => {
  const role = assertRequiredString(value, label);
  if (!TRUST_ROLE_PATTERN.test(role)) {
    throw new Error(`Invalid university fixture format: ${label}`);
  }
  return role as TrustRole;
};

const normalizeTrustAction = (
  value: unknown,
  label: string,
): "grant" | "revoke" => {
  const action = assertRequiredString(value, label);
  if (action !== "grant" && action !== "revoke") {
    throw new Error(`Invalid university fixture format: ${label}`);
  }
  return action;
};

const normalizeCompany = (
  company: unknown,
  index: number,
): UniversityFixtureCompany => {
  const raw = assertPlainObject(company, `companies[${index}]`);
  return {
    companyId: assertRequiredString(
      raw.companyId,
      `companies[${index}].companyId`,
    ),
    did: assertDidNamespace(
      normalizeDid(raw.did, `companies[${index}].did`),
      `companies[${index}].did`,
      UNIVERSITY_DID_NAMESPACE_PREFIXES.company,
    ),
    name: assertRequiredString(raw.name, `companies[${index}].name`),
    verificationThreshold: assertRequiredNumber(
      raw.verificationThreshold,
      `companies[${index}].verificationThreshold`,
    ),
    endpoint: assertRequiredString(
      raw.endpoint,
      `companies[${index}].endpoint`,
    ),
    role: (typeof raw.role === "string" ? raw.role : undefined) as
      | UniversityRole
      | undefined,
  };
};

const normalizeUniversity = (
  university: unknown,
): UniversityFixtureUniversity => {
  const raw = assertPlainObject(university, "university");
  return {
    did: assertDidNamespace(
      normalizeDid(raw.did, "university.did"),
      "university.did",
      UNIVERSITY_DID_NAMESPACE_PREFIXES.university,
    ),
    name: assertRequiredString(raw.name, "university.name"),
    issuerDid: assertDidNamespace(
      normalizeDid(raw.issuerDid, "university.issuerDid"),
      "university.issuerDid",
      UNIVERSITY_DID_NAMESPACE_PREFIXES.issuer,
    ),
    credentialStatusRef: assertRequiredString(
      raw.credentialStatusRef,
      "university.credentialStatusRef",
    ),
    role: (typeof raw.role === "string" ? raw.role : undefined) as
      | UniversityRole
      | undefined,
  };
};

const normalizeMall = (mall: unknown): UniversityFixtureMall => {
  const raw = assertPlainObject(mall, "mall");
  return {
    did: assertDidNamespace(
      normalizeDid(raw.did, "mall.did"),
      "mall.did",
      UNIVERSITY_DID_NAMESPACE_PREFIXES.mall,
    ),
    name: assertRequiredString(raw.name, "mall.name"),
    discountPercent: assertRequiredNumber(
      raw.discountPercent,
      "mall.discountPercent",
    ),
    gradeThreshold: assertRequiredNumber(
      raw.gradeThreshold,
      "mall.gradeThreshold",
    ),
    endpoint: assertRequiredString(raw.endpoint, "mall.endpoint"),
    role: (typeof raw.role === "string" ? raw.role : undefined) as
      | UniversityRole
      | undefined,
  };
};

const normalizeTrustEvents = (events: unknown): TrustRoleEvent[] => {
  if (!Array.isArray(events)) {
    return [];
  }
  const knownNamespaces = new Set([
    "did:midnight:edu",
    "did:midnight:gov",
    "did:midnight:org",
    "did:midnight:university",
    "did:midnight:verifier",
    "did:midnight:issuer",
    "did:midnight:key",
    "did:midnight:user",
  ]);

  return events.map((event, index) => {
    const raw = assertPlainObject(event, `trustRegistry.events[${index}]`);

    const role = normalizeTrustRole(
      raw.role,
      `trustRegistry.events[${index}].role`,
    );
    return {
      role,
      partyDid: assertDidNamespace(
        normalizeDid(raw.partyDid, `trustRegistry.events[${index}].partyDid`),
        `trustRegistry.events[${index}].partyDid`,
        knownNamespaces,
      ),
      actorDid: assertDidNamespace(
        normalizeDid(raw.actorDid, `trustRegistry.events[${index}].actorDid`),
        `trustRegistry.events[${index}].actorDid`,
        knownNamespaces,
      ),
      action: normalizeTrustAction(
        raw.action,
        `trustRegistry.events[${index}].action`,
      ),
      effectiveAt: assertRequiredString(
        raw.effectiveAt,
        `trustRegistry.events[${index}].effectiveAt`,
      ),
      reason: assertRequiredString(
        raw.reason,
        `trustRegistry.events[${index}].reason`,
      ),
    };
  });
};

const normalizeTrustRegistry = (trustRegistry: unknown): TrustRegistryState => {
  const raw = assertPlainObject(trustRegistry, "trustRegistry");
  const registryId = assertRequiredString(
    raw.registryId,
    "trustRegistry.registryId",
  );
  const updatedAt = assertRequiredString(
    raw.updatedAt,
    "trustRegistry.updatedAt",
  );

  return {
    registryId,
    updatedAt: parseIso(updatedAt),
    events: normalizeTrustEvents(raw.events),
  };
};

const normalizeIssuedBatches = (rawBatches: unknown): string[][] => {
  if (!Array.isArray(rawBatches)) {
    throw new Error("Invalid university fixture format: issuanceBatches");
  }
  return rawBatches.map((batch, index) => {
    if (!Array.isArray(batch)) {
      throw new Error(
        `Invalid university fixture format: issuanceBatches[${index}]`,
      );
    }
    return batch.map((studentId, nestedIndex) => {
      if (typeof studentId !== "string" || studentId.trim() === "") {
        throw new Error(
          `Invalid university fixture format: issuanceBatches[${index}][${nestedIndex}]`,
        );
      }
      return studentId;
    });
  });
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

  return JSON.stringify(normalize(value)) ?? "null";
};

const toPositiveInteger = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid university fixture generator option: ${label}`);
  }

  const normalized = Math.floor(value);
  if (normalized < 1) {
    throw new Error(`Invalid university fixture generator option: ${label}`);
  }

  return normalized;
};

const normalizeOptionalPositiveInteger = (
  value: unknown,
  max: number,
  label: string,
): number | undefined => {
  if (value == null) {
    return undefined;
  }

  const numeric = toPositiveInteger(value, label);
  return Math.min(numeric, max);
};

const seedStringToUint32 = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
    hash >>>= 0;
  }
  return hash >>> 0;
};

const normalizeFixtureSeed = (seed: number | string = 0): number => {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      throw new Error("Invalid university fixture generator option: seed");
    }
    return Math.floor(seed) >>> 0;
  }

  return seedStringToUint32(seed.trim());
};

const createDeterministicRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleWithSeed = <T>(items: T[], random: () => number): T[] => {
  const reordered = [...items];
  for (let index = reordered.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = reordered[index];
    reordered[index] = reordered[swap]!;
    reordered[swap] = current!;
  }
  return reordered;
};

const compareEntityIds = (left: string, right: string): number => {
  const leftMatch = left.match(/(\d+)$/);
  const rightMatch = right.match(/(\d+)$/);
  if (leftMatch != null && rightMatch != null) {
    const leftValue = Number(leftMatch[1]);
    const rightValue = Number(rightMatch[1]);
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return left.localeCompare(right);
};

const pickWithRandom = <T>(items: readonly T[], random: () => number): T => {
  const index = Math.floor(random() * items.length);
  return items[index]!;
};

const normalizeGradeBounds = (
  value: unknown,
  label: string,
): [number, number] => {
  const integer = toPositiveInteger(value, label);
  return [integer, 100];
};

const generateUniversityEntityDid = (
  namespace: string,
  seed: number,
  index: number,
): string => {
  return `did:midnight:${namespace}:seed-${seed.toString(16)}-${String(index).padStart(3, "0")}`;
};

const generateUniversityId = (prefix: string, index: number): string => {
  return `${prefix}${String(index).padStart(3, "0")}`;
};

const hashPayload = (value: unknown): string => {
  const payload = canonicalStringify(value);
  return createHash("sha256").update(payload).digest("hex");
};

const toStepId = (stepIndex: number, label: string): string => {
  const safeLabel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${String(stepIndex + 1).padStart(2, "0")}-${safeLabel}`;
};

const waitMs = (value: number): Promise<void> => {
  if (value <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, value));
};

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

const normalizeIdList = (values?: string[]): string[] | undefined => {
  if (values == null || values.length === 0) {
    return undefined;
  }

  const normalized = Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
  return normalized.length === 0 ? undefined : normalized;
};

const assertIdentifiersExist = (
  label: string,
  requested: string[] | undefined,
  known: readonly { [key: string]: unknown }[],
  key: string,
): void => {
  if (requested == null) {
    return;
  }

  const knownIds = new Set(known.map((item) => String(item[key])));
  const missing = requested.filter((value) => !knownIds.has(value));
  if (missing.length > 0) {
    throw new Error(`Unknown ${label} identifiers: ${missing.join(", ")}`);
  }
};

const asMarkdownBlock = (value: unknown): string =>
  JSON.stringify(value, null, 2).replace(/^/gm, "  ");

const assertArtifactObject = (
  value: unknown,
  label: string,
): Record<string, unknown> => {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid university artifact format: ${label}`);
  }

  return value as Record<string, unknown>;
};

const toArtifactVersion = (value: unknown, fallback: string): string => {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return fallback;
};

export const normalizeUniversityScenarioReportArtifact = (
  raw: unknown,
): UniversityScenarioReportArtifact => {
  const artifact = assertArtifactObject(raw, "report artifact");
  const metadata = assertArtifactObject(artifact.metadata, "metadata");
  const timing = assertArtifactObject(artifact.timing, "timing");

  return {
    artifactVersion: toArtifactVersion(
      artifact.artifactVersion,
      UNIVERSITY_SCENARIO_REPORT_ARTIFACT_VERSION,
    ),
    scenarioTitle: assertRequiredString(
      artifact.scenarioTitle,
      "scenarioTitle",
    ),
    generatedAt: assertRequiredString(artifact.generatedAt, "generatedAt"),
    metadata: {
      mode: assertRequiredString(
        metadata.mode,
        "metadata.mode",
      ) as UniversityTransportMode,
      fixtureVersion: assertRequiredString(
        metadata.fixtureVersion,
        "metadata.fixtureVersion",
      ),
      studentsTargeted: assertRequiredNumber(
        metadata.studentsTargeted,
        "metadata.studentsTargeted",
      ),
      companiesTargeted: assertRequiredNumber(
        metadata.companiesTargeted,
        "metadata.companiesTargeted",
      ),
      totalStudents: assertRequiredNumber(
        metadata.totalStudents,
        "metadata.totalStudents",
      ),
      totalCompanies: assertRequiredNumber(
        metadata.totalCompanies,
        "metadata.totalCompanies",
      ),
    },
    timing: {
      totalSteps: assertRequiredNumber(timing.totalSteps, "timing.totalSteps"),
      totalLatencyMs: assertRequiredNumber(
        timing.totalLatencyMs,
        "timing.totalLatencyMs",
      ),
      avgLatencyMs: assertRequiredNumber(
        timing.avgLatencyMs,
        "timing.avgLatencyMs",
      ),
    },
    issuedCount: assertRequiredNumber(artifact.issuedCount, "issuedCount"),
    applicationCount: assertRequiredNumber(
      artifact.applicationCount,
      "applicationCount",
    ),
    discountCount: assertRequiredNumber(
      artifact.discountCount,
      "discountCount",
    ),
    approvedApplications: assertRequiredNumber(
      artifact.approvedApplications,
      "approvedApplications",
    ),
    approvedDiscounts: assertRequiredNumber(
      artifact.approvedDiscounts,
      "approvedDiscounts",
    ),
    steps: Array.isArray(artifact.steps)
      ? artifact.steps.map((step) => {
          const entry = assertArtifactObject(step, "step");
          return {
            step: assertRequiredString(entry.step, "step.step"),
            request: entry.request as unknown,
            response: entry.response as unknown,
            checks: Array.isArray(entry.checks)
              ? entry.checks.map((item) => assertRequiredString(item, "check"))
              : [],
            involvedDids: Array.isArray(entry.involvedDids)
              ? entry.involvedDids.map((item) =>
                  assertRequiredString(item, "did"),
                )
              : [],
            latencyMs: assertRequiredNumber(entry.latencyMs, "latencyMs"),
            stepId: assertRequiredString(entry.stepId, "stepId"),
            requestId: assertRequiredString(entry.requestId, "requestId"),
            requestHash: assertRequiredString(entry.requestHash, "requestHash"),
            responseHash: assertRequiredString(
              entry.responseHash,
              "responseHash",
            ),
            startedAt: assertRequiredString(entry.startedAt, "startedAt"),
            endedAt: assertRequiredString(entry.endedAt, "endedAt"),
            transportChecks: Array.isArray(entry.transportChecks)
              ? entry.transportChecks.map((item) =>
                  assertRequiredString(item, "transportCheck"),
                )
              : [],
            proofPlaceholders: Array.isArray(entry.proofPlaceholders)
              ? entry.proofPlaceholders.map((item) =>
                  assertRequiredString(item, "proofPlaceholder"),
                )
              : undefined,
            didBindingChecks: Array.isArray(entry.didBindingChecks)
              ? entry.didBindingChecks.map((item) =>
                  assertRequiredString(item, "didBindingCheck"),
                )
              : undefined,
          };
        })
      : [],
  };
};

export const normalizeUniversityScenarioReplayArtifact = (
  raw: unknown,
): UniversityScenarioReplayArtifact => {
  const artifact = assertArtifactObject(raw, "replay artifact");

  return {
    artifactVersion: toArtifactVersion(
      artifact.artifactVersion,
      UNIVERSITY_SCENARIO_REPLAY_ARTIFACT_VERSION,
    ),
    scenarioTitle: assertRequiredString(
      artifact.scenarioTitle,
      "scenarioTitle",
    ),
    generatedAt: assertRequiredString(artifact.generatedAt, "generatedAt"),
    mode: assertRequiredString(
      artifact.mode,
      "mode",
    ) as UniversityTransportMode,
    steps: Array.isArray(artifact.steps)
      ? artifact.steps.map((step) => {
          const entry = assertArtifactObject(step, "step");
          return {
            step: assertRequiredString(entry.step, "step.step"),
            stepId: assertRequiredString(entry.stepId, "stepId"),
            requestId: assertRequiredString(entry.requestId, "requestId"),
            requestHash: assertRequiredString(entry.requestHash, "requestHash"),
            responseHash: assertRequiredString(
              entry.responseHash,
              "responseHash",
            ),
            proofPlaceholders: Array.isArray(entry.proofPlaceholders)
              ? entry.proofPlaceholders.map((item) =>
                  assertRequiredString(item, "proofPlaceholder"),
                )
              : undefined,
            didBindingChecks: Array.isArray(entry.didBindingChecks)
              ? entry.didBindingChecks.map((item) =>
                  assertRequiredString(item, "didBindingCheck"),
                )
              : undefined,
            startedAt: assertRequiredString(entry.startedAt, "startedAt"),
            endedAt: assertRequiredString(entry.endedAt, "endedAt"),
            latencyMs: assertRequiredNumber(entry.latencyMs, "latencyMs"),
            involvedDids: Array.isArray(entry.involvedDids)
              ? entry.involvedDids.map((item) =>
                  assertRequiredString(item, "did"),
                )
              : [],
          };
        })
      : [],
  };
};

export const computeCredentialDigest = (
  credential: Omit<UniversityDiplomaCredential, "proofDigest">,
): string => {
  return createHash("sha256")
    .update(canonicalStringify(credential), "utf8")
    .digest("hex");
};

export const generateUniversityFixture = (
  options: UniversityFixtureGeneratorOptions,
): UniversityFixture => {
  const studentCount = toPositiveInteger(options.studentCount, "studentCount");
  const companyCount = toPositiveInteger(
    options.companyCount ?? 3,
    "companyCount",
  );
  const batchSize = toPositiveInteger(options.batchSize ?? 25, "batchSize");

  const seed = normalizeFixtureSeed(options.seed ?? 0);
  const random = createDeterministicRandom(seed);
  const createdAt = parseIso(options.createdAt ?? "2026-05-14T00:00:00.000Z");

  const scenarioVersion =
    options.scenarioVersion?.trim() === ""
      ? "university-v1"
      : (options.scenarioVersion ?? "university-v1");
  const scenarioTitle =
    options.scenarioTitle?.trim() === ""
      ? "University Diploma Issuance and Presentation (BDD stress)"
      : (options.scenarioTitle ??
        "University Diploma Issuance and Presentation (BDD stress)");

  const givenNames = [
    "Avery",
    "Brook",
    "Casey",
    "Devin",
    "Eden",
    "Frank",
    "Harper",
    "Jordan",
    "Kiran",
    "Noah",
    "Riley",
    "Sage",
    "Tara",
  ];

  const familyNames = [
    "Adler",
    "Bishop",
    "Cohen",
    "Diaz",
    "Evans",
    "Fischer",
    "Gray",
    "Hale",
    "Ibrahim",
    "Jin",
    "Klein",
    "Lopez",
  ];

  const programs = [
    "Applied AI",
    "Computer Security",
    "Cryptography",
    "Data Science",
    "Distributed Systems",
    "Human Factors",
    "Information Systems",
    "Network Security",
    "Software Engineering",
    "Systems Design",
    "Web3 Privacy",
  ];

  const [gradeFloor] = normalizeGradeBounds(
    options.gradeFloor ?? 60,
    "gradeFloor",
  );
  const gradeCeil = Math.min(
    Math.max(
      toPositiveInteger(options.gradeCeil ?? 99, "gradeCeil"),
      gradeFloor,
    ),
    100,
  );

  const students: UniversityFixtureStudent[] = Array.from(
    { length: studentCount },
    (_, index) => {
      const studentId = generateUniversityId("S", index + 1);
      const firstName = pickWithRandom(givenNames, random);
      const lastName = pickWithRandom(familyNames, random);
      return {
        did: generateUniversityEntityDid("user", seed, index + 1),
        studentId,
        fullName: `${firstName} ${lastName}`,
        program: pickWithRandom(programs, random),
        graduationTerm: "2026-05",
        grade: Math.floor(random() * (gradeCeil - gradeFloor + 1)) + gradeFloor,
      };
    },
  );

  const companies: UniversityFixtureCompany[] = Array.from(
    { length: companyCount },
    (_, index) => {
      const companyId = generateUniversityId("C", index + 1);
      const thresholdBase = 78;
      const thresholdRange = 20;
      return {
        did: generateUniversityEntityDid("org", seed + 1, index + 1),
        companyId,
        name: `Verifier ${companyId}`,
        verificationThreshold:
          thresholdBase + Math.floor(random() * thresholdRange),
        endpoint: `https://verifier-${index + 1}.example/ssi`,
      };
    },
  );

  const issuanceStudentIds = shuffleWithSeed(
    students.map((student) => student.studentId),
    random,
  );
  const issuanceBatches: string[][] = [];
  for (let index = 0; index < issuanceStudentIds.length; index += batchSize) {
    issuanceBatches.push(issuanceStudentIds.slice(index, index + batchSize));
  }

  const statusRef = "urn:vc-status:midnight:university-diploma:2026";
  const statusRegistry: VcStatusRegistry = {
    statusRef,
    statusPurpose: "revocation",
    issuedAt: createdAt,
    credentials: Object.fromEntries(
      students.map((student) => [
        `${statusRef}:${student.studentId}`,
        {
          state: "active",
          statusReason: "active",
          updatedAt: createdAt,
        },
      ]),
    ),
  };

  const trustRegistry: TrustRegistryState = {
    registryId: `university-stress-trust-${seed}`,
    updatedAt: createdAt,
    events: [
      {
        role: TRUST_ROLE_ISSUER,
        partyDid: "did:midnight:edu:midnight-state-university",
        actorDid: "did:midnight:gov:state-registry",
        action: "grant",
        effectiveAt: createdAt,
        reason: "University stress fixture issuance trust",
      },
      ...companies.map(
        (company): TrustRoleGrant => ({
          role: TRUST_ROLE_VERIFIER as TrustRole,
          partyDid: company.did,
          actorDid: "did:midnight:edu:midnight-state-university",
          action: "grant" as const,
          effectiveAt: createdAt,
          reason: `Verifier onboarding (${company.companyId})`,
        }),
      ),
    ],
  };

  const mallGradeThreshold =
    options.mallGradeThreshold == null
      ? 90
      : Math.max(
          toPositiveInteger(options.mallGradeThreshold, "mallGradeThreshold"),
          60,
        );
  const mallDiscountPercent = Math.max(
    5,
    Math.min(
      toPositiveInteger(
        options.mallDiscountPercent ?? 15,
        "mallDiscountPercent",
      ),
      100,
    ),
  );

  return {
    scenarioVersion,
    scenarioTitle,
    createdAt,
    university: {
      did: "did:midnight:edu:midnight-state-university",
      name: "Midnight State University",
      issuerDid: "did:midnight:key:university-issuer",
      credentialStatusRef: statusRef,
    },
    students,
    companies,
    mall: {
      did: "did:midnight:org:midnight-state-mall",
      name: "Midnight Commerce Mall",
      discountPercent: mallDiscountPercent,
      gradeThreshold: mallGradeThreshold,
      endpoint: "https://mall.example/ssi",
    },
    issuanceBatches,
    statusRegistry,
    trustRegistry,
  };
};

export const shrinkUniversityFixture = (
  fixture: UniversityFixture,
  options?: UniversityFixtureShrinkOptions,
): UniversityFixture => {
  const random = createDeterministicRandom(normalizeFixtureSeed(options?.seed));
  const studentCount = normalizeOptionalPositiveInteger(
    options?.studentCount,
    fixture.students.length,
    "studentCount",
  );
  const companyCount = normalizeOptionalPositiveInteger(
    options?.companyCount,
    fixture.companies.length,
    "companyCount",
  );

  if (studentCount === 0 || companyCount === 0) {
    throw new Error(
      "Invalid university fixture shrink option: count must be >= 1",
    );
  }

  const sortedStudentIds = fixture.students
    .map((student) => student.studentId)
    .sort(compareEntityIds);
  const sortedCompanyIds = fixture.companies
    .map((company) => company.companyId)
    .sort(compareEntityIds);

  const studentIds =
    studentCount == null
      ? sortedStudentIds
      : shuffleWithSeed(sortedStudentIds, random)
          .slice(0, studentCount)
          .sort(compareEntityIds);

  const companyIds =
    companyCount == null
      ? sortedCompanyIds
      : shuffleWithSeed(sortedCompanyIds, random)
          .slice(0, companyCount)
          .sort(compareEntityIds);

  return deriveUniversityFixtureSubset(fixture, {
    studentIds,
    companyIds,
  });
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

  if (
    typeof fixture.scenarioVersion !== "string" ||
    fixture.scenarioVersion.trim() === ""
  ) {
    throw new Error(
      `Invalid university fixture format: missing scenarioVersion`,
    );
  }

  if (
    typeof fixture.scenarioTitle !== "string" ||
    fixture.scenarioTitle.trim() === ""
  ) {
    throw new Error(`Invalid university fixture format: missing scenarioTitle`);
  }

  if (
    typeof fixture.createdAt !== "string" ||
    fixture.createdAt.trim() === ""
  ) {
    throw new Error(`Invalid university fixture format: missing createdAt`);
  }

  const normalizedUniversity = normalizeUniversity(fixture.university);
  const normalizedStudents = Array.isArray(fixture.students)
    ? fixture.students.map((student, index) => normalizeStudent(student, index))
    : [];

  if (normalizedStudents.length === 0) {
    throw new Error(`Invalid university fixture format: students missing`);
  }

  const normalizedCompanies = Array.isArray(fixture.companies)
    ? fixture.companies.map((company, index) =>
        normalizeCompany(company, index),
      )
    : [];

  if (normalizedCompanies.length === 0) {
    throw new Error(`Invalid university fixture format: companies missing`);
  }

  if (fixture.issuanceBatches == null) {
    throw new Error(
      `Invalid university fixture format: missing issuanceBatches`,
    );
  }

  const normalizedMall = normalizeMall(fixture.mall);
  const normalizedIssuanceBatches = normalizeIssuedBatches(
    fixture.issuanceBatches,
  );
  const statusRegistry = assertPlainObject(
    fixture.statusRegistry,
    "statusRegistry",
  );
  const trustRegistry = normalizeTrustRegistry(fixture.trustRegistry);

  const createdAt = parseIso(fixture.createdAt);

  return {
    ...fixture,
    scenarioTitle: fixture.scenarioTitle,
    createdAt,
    university: normalizedUniversity,
    students: normalizedStudents,
    companies: normalizedCompanies,
    mall: normalizedMall,
    issuanceBatches: normalizedIssuanceBatches,
    statusRegistry: {
      ...statusRegistry,
    } as VcStatusRegistry,
    trustRegistry: {
      ...trustRegistry,
    },
    scenarioVersion: fixture.scenarioVersion.trim(),
  };
};

export const deriveUniversityFixtureSubset = (
  fixture: UniversityFixture,
  options?: UniversityFixtureSubsetOptions,
): UniversityFixture => {
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

  const selectedStudentIds = studentIds == null ? null : new Set(studentIds);
  const selectedCompanyIds = companyIds == null ? null : new Set(companyIds);

  const students = fixture.students.filter((student) =>
    selectedStudentIds == null
      ? true
      : selectedStudentIds.has(student.studentId),
  );
  const companies = fixture.companies.filter((company) =>
    selectedCompanyIds == null
      ? true
      : selectedCompanyIds.has(company.companyId),
  );

  const selectedStudents = new Set(
    students.map((student) => student.studentId),
  );
  const issuanceBatches = fixture.issuanceBatches
    .map((batch) =>
      batch.filter((studentId) => selectedStudents.has(studentId)),
    )
    .filter((batch) => batch.length > 0);

  const filteredTitleSuffix =
    studentIds == null && companyIds == null
      ? ""
      : ` (filtered studentIds=${studentIds?.join(",") ?? "all"}, companyIds=${
          companyIds?.join(",") ?? "all"
        })`;

  return {
    ...fixture,
    students,
    companies,
    issuanceBatches,
    scenarioTitle: `${fixture.scenarioTitle}${filteredTitleSuffix}`,
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

export const collectUniversityPartySamples = (
  report: UniversityScenarioResult,
): UniversityPartySamples => {
  const issueStep = report.steps.find(
    (step) => step.step === "Issue diploma VC across batches",
  )?.response as UniversityIssuanceStepResponse | undefined;

  const presentationStep = report.steps.find(
    (step) => step.step === "Student-to-verifier presentation requests",
  )?.response as UniversityPresentationStepResponse | undefined;

  const discountStep = report.steps.find(
    (step) => step.step === "Student-to-mall discount presentations",
  )?.response as UniversityDiscountStepResponse | undefined;

  const studentToUniversity = (issueStep?.issuedRequests ?? []).map(
    ({ request, response }) => ({
      senderDid: request.studentDid,
      receiverDid: request.universityDid,
      request,
      response,
    }),
  );

  const studentToVerifier = (presentationStep?.presentationResults ?? []).map(
    ({ student, credential, response, ...request }) => ({
      senderDid: request.studentDid,
      receiverDid: request.verifierDid,
      request: {
        ...request,
        student,
        credential,
      },
      response,
    }),
  );

  const studentToMall = (discountStep?.discountRequests ?? []).map(
    ({ student, credential, response, ...request }) => ({
      senderDid: request.studentDid,
      receiverDid: request.mallDid,
      request: {
        ...request,
        student,
        credential,
      },
      response,
    }),
  );

  return {
    studentToUniversity,
    studentToVerifier,
    studentToMall,
  };
};

export const formatUniversityScenarioNotes = (
  report: UniversityScenarioResult,
): string => {
  return report.steps
    .map((step) => {
      return [
        `Step: ${step.step}`,
        `Involved DIDs: ${step.involvedDids.join(", ") || "none"}`,
        "Request:",
        asMarkdownBlock(step.request),
        "Response:",
        asMarkdownBlock(step.response),
        `Checks:`,
        step.checks.map((check) => `- ${check}`).join("\n"),
      ].join("\n");
    })
    .join("\n\n");
};

export const summarizeUniversityScenario = (
  report: UniversityScenarioResult,
): string => {
  return [
    `University BDD summary for: ${report.scenarioTitle}`,
    `Mode: ${report.metadata.mode}`,
    `Executed at: ${report.generatedAt}`,
    `Students: ${report.metadata.studentsTargeted}/${report.metadata.totalStudents}`,
    `Verifiers: ${report.metadata.companiesTargeted}/${report.metadata.totalCompanies}`,
    `Issued: ${report.issuedCount}`,
    `Applications: ${report.applicationCount} (${report.approvedApplications} approved)`,
    `Discounts: ${report.discountCount} (${report.approvedDiscounts} approved)`,
    `Latency: ${report.timing.totalLatencyMs}ms over ${report.timing.totalSteps} steps`,
  ].join("\n");
};

export const toUniversityScenarioArtifact = (
  report: UniversityScenarioResult,
): UniversityScenarioReportArtifact => ({
  artifactVersion: UNIVERSITY_SCENARIO_REPORT_ARTIFACT_VERSION,
  scenarioTitle: report.scenarioTitle,
  generatedAt: report.generatedAt,
  metadata: report.metadata,
  timing: report.timing,
  issuedCount: report.issuedCount,
  applicationCount: report.applicationCount,
  discountCount: report.discountCount,
  approvedApplications: report.approvedApplications,
  approvedDiscounts: report.approvedDiscounts,
  steps: report.steps.map((step) => ({
    step: step.step,
    request: step.request,
    response: step.response,
    checks: step.checks,
    involvedDids: step.involvedDids,
    latencyMs: step.latencyMs,
    stepId: step.stepId,
    requestId: step.requestId,
    requestHash: step.requestHash,
    responseHash: step.responseHash,
    startedAt: step.startedAt,
    endedAt: step.endedAt,
  })),
});

export const toUniversityScenarioReplayArtifact = (
  report: UniversityScenarioResult,
): UniversityScenarioReplayArtifact => ({
  artifactVersion: UNIVERSITY_SCENARIO_REPLAY_ARTIFACT_VERSION,
  scenarioTitle: report.scenarioTitle,
  generatedAt: report.generatedAt,
  mode: report.metadata.mode,
  steps: report.steps.map((step) => ({
    step: step.step,
    stepId: step.stepId,
    requestId: step.requestId,
    requestHash: step.requestHash,
    responseHash: step.responseHash,
    proofPlaceholders: step.proofPlaceholders,
    didBindingChecks: step.didBindingChecks,
    startedAt: step.startedAt,
    endedAt: step.endedAt,
    latencyMs: step.latencyMs,
    involvedDids: step.involvedDids,
  })),
});
