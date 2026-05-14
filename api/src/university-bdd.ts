import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertTrustRoleActive,
  evaluateTrustRole,
  TRUST_ROLE_ISSUER,
  TRUST_ROLE_VERIFIER,
  TRUST_ROLE_PATTERN,
  type TrustRegistryState,
  type TrustRole,
  type TrustRoleEvent,
} from "./trust-registry";
import {
  evaluateVcStatus,
  type VcStatusReference,
  type VcStatusRegistry,
  type VerifiableCredential,
} from "./vc-status";

export const UNIVERSITY_DID_METHOD_PATTERN =
  /^did:midnight:[a-z0-9][a-z0-9._-]*:[a-zA-Z0-9._-]+$/;

export const UNIVERSITY_DID_NAMESPACE_PREFIXES = {
  university: new Set(["did:midnight:edu", "did:midnight:gov"]),
  issuer: new Set(["did:midnight:key", "did:midnight:gov", "did:midnight:edu"]),
  student: new Set(["did:midnight:user"]),
  company: new Set(["did:midnight:org", "did:midnight:gov"]),
  mall: new Set(["did:midnight:org"]),
} as const;

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

export type UniversityFixtureStudent = Omit<UniversityEntity, "name"> & {
  studentId: string;
  fullName: string;
  program: string;
  graduationTerm: string;
  grade: number;
  name?: string;
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

export type UniversityFixtureSubsetOptions = {
  studentIds?: string[];
  companyIds?: string[];
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

type UniversityIssuanceInvocation = {
  studentId: string;
  batchIndex: number;
  batchPosition: number;
  request: UniversityIssuanceRequestContext;
  response: UniversityIssuanceDecision;
};

export type UniversityPresentationStepResponse = {
  presentationResults: Array<
    UniversityPresentationRequestContext & {
      response: UniversityPresentationDecision;
      studentId: string;
      student: UniversityFixtureStudent;
      credential: UniversityDiplomaCredential;
    }
  >;
  accepted: number;
};

export type UniversityDiscountStepResponse = {
  discountRequests: Array<
    UniversityDiscountRequest & {
      response: UniversityDiscountResponse;
      studentId: string;
      student: UniversityFixtureStudent;
      credential: UniversityDiplomaCredential;
      gradeThreshold: number;
      createdAt: string;
    }
  >;
  acceptedDiscounts: number;
};

export type UniversityIssuanceStepResponse = {
  issuedByBatch: Array<{
    batchIndex: number;
    issued: string[];
    skipped: string[];
  }>;
  issuedRequests: UniversityIssuanceInvocation[];
  totalIssued: number;
};

export type UniversityPartySample<Request, Response> = {
  senderDid: string;
  receiverDid: string;
  request: Request;
  response: Response;
};

export type UniversityPartySamples = {
  studentToUniversity: UniversityPartySample<
    UniversityIssuanceRequestContext,
    UniversityIssuanceDecision
  >[];
  studentToVerifier: UniversityPartySample<
    UniversityPresentationRequestContext,
    UniversityPresentationDecision
  >[];
  studentToMall: UniversityPartySample<
    UniversityDiscountRequestContext,
    UniversityDiscountResponse
  >[];
};

export type UniversityTransport = {
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

export type UniversityTransportContext = {
  fixture: UniversityFixture;
  now: string;
  mode: UniversityTransportMode;
};

export type UniversityTransportFactory = (
  fixture: UniversityFixture,
  context: UniversityTransportContext,
) => UniversityTransport;

export type UniversityTransportMode = UniversityRuntimeMode;

export type UniversityTransportFactoryByMode = {
  [mode in UniversityTransportMode]: UniversityTransportFactory;
};

export type UniversityScenarioStepLog = {
  step: string;
  request: unknown;
  response: unknown;
  checks: string[];
  involvedDids: string[];
  latencyMs: number;
  stepId: string;
  requestId: string;
  requestHash: string;
  responseHash: string;
  startedAt: string;
  endedAt: string;
};

export type UniversityScenarioReplayStep = {
  step: string;
  stepId: string;
  requestId: string;
  requestHash: string;
  responseHash: string;
  startedAt: string;
  endedAt: string;
  latencyMs: number;
  involvedDids: string[];
};

export type UniversityScenarioReplayArtifact = {
  scenarioTitle: string;
  generatedAt: string;
  mode: UniversityTransportMode;
  steps: UniversityScenarioReplayStep[];
};

export type UniversityScenarioResult = {
  scenarioTitle: string;
  generatedAt: string;
  metadata: {
    mode: UniversityTransportMode;
    fixtureVersion: string;
    studentsTargeted: number;
    companiesTargeted: number;
    totalStudents: number;
    totalCompanies: number;
  };
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

export type UniversityScenarioFilter = {
  studentIds?: string[];
  companyIds?: string[];
};

export type UniversityScenarioReportArtifact = Omit<
  UniversityScenarioResult,
  "credentials"
>;

export type UniversityScenarioReplayResult = UniversityScenarioReplayArtifact;

const assertPlainObject = (value: unknown, label: string): Record<string, unknown> => {
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
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
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

const didNamespace = (did: string): string => did.split(":").slice(0, 3).join(":");

const assertDidNamespace = (
  did: string,
  label: string,
  allowed: Set<string>,
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
    studentId: assertRequiredString(raw.studentId, `students[${index}].studentId`),
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
    endpoint: assertRequiredString(raw.endpoint, `companies[${index}].endpoint`),
    role: (typeof raw.role === "string" ? raw.role : undefined) as
      | UniversityRole
      | undefined,
  };
};

const normalizeUniversity = (university: unknown): UniversityFixtureUniversity => {
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

const normalizeTrustEvents = (
  events: unknown,
): TrustRoleEvent[] => {
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

    const role = normalizeTrustRole(raw.role, `trustRegistry.events[${index}].role`);
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
      action: normalizeTrustAction(raw.action, `trustRegistry.events[${index}].action`),
      effectiveAt: assertRequiredString(
        raw.effectiveAt,
        `trustRegistry.events[${index}].effectiveAt`,
      ),
      reason: assertRequiredString(raw.reason, `trustRegistry.events[${index}].reason`),
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
      throw new Error(`Invalid university fixture format: issuanceBatches[${index}]`);
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

  if (typeof fixture.scenarioVersion !== "string" || fixture.scenarioVersion.trim() === "") {
    throw new Error(
      `Invalid university fixture format: missing scenarioVersion`,
    );
  }

  if (typeof fixture.scenarioTitle !== "string" || fixture.scenarioTitle.trim() === "") {
    throw new Error(`Invalid university fixture format: missing scenarioTitle`);
  }

  if (typeof fixture.createdAt !== "string" || fixture.createdAt.trim() === "") {
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
    ? fixture.companies.map((company, index) => normalizeCompany(company, index))
    : [];

  if (normalizedCompanies.length === 0) {
    throw new Error(`Invalid university fixture format: companies missing`);
  }

  if (fixture.issuanceBatches == null) {
    throw new Error(`Invalid university fixture format: missing issuanceBatches`);
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

  assertIdentifiersExist("studentId", studentIds, fixture.students, "studentId");
  assertIdentifiersExist("companyId", companyIds, fixture.companies, "companyId");

  const selectedStudentIds = studentIds == null ? null : new Set(studentIds);
  const selectedCompanyIds = companyIds == null ? null : new Set(companyIds);

  const students = fixture.students.filter((student) =>
    selectedStudentIds == null ? true : selectedStudentIds.has(student.studentId),
  );
  const companies = fixture.companies.filter((company) =>
    selectedCompanyIds == null ? true : selectedCompanyIds.has(company.companyId),
  );

  const selectedStudents = new Set(students.map((student) => student.studentId));
  const issuanceBatches = fixture.issuanceBatches
    .map((batch) => batch.filter((studentId) => selectedStudents.has(studentId)))
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
  });
};

export const runUniversityDiplomaScenario = async (
  fixture: UniversityFixture,
  options?: {
    mode?: UniversityTransportMode;
    transport?: UniversityTransport;
    transportFactories?: Partial<UniversityTransportFactoryByMode>;
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
    });
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
  scenarioTitle: report.scenarioTitle,
  generatedAt: report.generatedAt,
  mode: report.metadata.mode,
  steps: report.steps.map((step) => ({
    step: step.step,
    stepId: step.stepId,
    requestId: step.requestId,
    requestHash: step.requestHash,
    responseHash: step.responseHash,
    startedAt: step.startedAt,
    endedAt: step.endedAt,
    latencyMs: step.latencyMs,
    involvedDids: step.involvedDids,
  })),
});
