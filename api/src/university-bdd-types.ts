import type { TrustRegistryState } from "./trust-registry";
import type { VcStatusReference, VcStatusRegistry } from "./vc-status";

export const UNIVERSITY_SCENARIO_REPORT_ARTIFACT_VERSION = "1.1.0";
export const UNIVERSITY_SCENARIO_REPLAY_ARTIFACT_VERSION = "1.1.0";

export const UNIVERSITY_DID_METHOD_PATTERN =
  /^did:midnight:[a-z0-9][a-z0-9._-]*:[a-zA-Z0-9._-]+$/;

const UNIVERSITY_DID_NAMESPACE_MUTATORS = new Set<PropertyKey>([
  "add",
  "clear",
  "delete",
]);

const readonlyNamespaceSet = (
  values: readonly string[],
): ReadonlySet<string> => {
  const set = new Set(values);
  const boundMethods = new Map<PropertyKey, unknown>();

  return new Proxy(set, {
    get(target, property) {
      if (UNIVERSITY_DID_NAMESPACE_MUTATORS.has(property)) {
        return () => {
          throw new TypeError("University DID namespace prefixes are readonly");
        };
      }

      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") {
        return value;
      }

      const cachedMethod = boundMethods.get(property);
      if (cachedMethod != null) {
        return cachedMethod;
      }

      const boundMethod = value.bind(target);
      boundMethods.set(property, boundMethod);
      return boundMethod;
    },
    defineProperty() {
      return false;
    },
    deleteProperty() {
      return false;
    },
    set() {
      return false;
    },
  }) as ReadonlySet<string>;
};

export const UNIVERSITY_DID_NAMESPACE_PREFIXES = {
  university: readonlyNamespaceSet(["did:midnight:edu", "did:midnight:gov"]),
  issuer: readonlyNamespaceSet([
    "did:midnight:key",
    "did:midnight:gov",
    "did:midnight:edu",
  ]),
  student: readonlyNamespaceSet(["did:midnight:user"]),
  company: readonlyNamespaceSet(["did:midnight:org", "did:midnight:gov"]),
  mall: readonlyNamespaceSet(["did:midnight:org"]),
} as const;

const namespaceValues = (
  namespaces: Record<string, ReadonlySet<string>>,
): string[] => Object.values(namespaces).flatMap((namespace) => [...namespace]);

export const UNIVERSITY_DID_TRUST_EVENT_NAMESPACE_PREFIXES =
  readonlyNamespaceSet([
    ...new Set([
      ...namespaceValues(UNIVERSITY_DID_NAMESPACE_PREFIXES),
      "did:midnight:issuer",
      "did:midnight:university",
      "did:midnight:verifier",
    ]),
  ]);

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

export type UniversityFixtureGeneratorOptions = {
  studentCount: number;
  companyCount?: number;
  seed?: number | string;
  scenarioVersion?: string;
  scenarioTitle?: string;
  createdAt?: string;
  batchSize?: number;
  gradeFloor?: number;
  gradeCeil?: number;
  mallGradeThreshold?: number;
  mallDiscountPercent?: number;
};

export type UniversityFixtureShrinkOptions = {
  studentCount?: number;
  companyCount?: number;
  seed?: number | string;
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

export type UniversityIssuanceInvocation = {
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

export type UniversityTransportRetryOptions = {
  maxRetries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
};

export type UniversityTransportOperationMetrics = {
  operation: string;
  attempts: number;
  retries: number;
  timeoutEvents: number;
};

export type UniversityRuntimeMode = "simulator" | "standalone";

export type UniversityTransportMode = UniversityRuntimeMode;

export type UniversityTransportContext = {
  fixture: UniversityFixture;
  now: string;
  mode: UniversityTransportMode;
  retryOptions?: UniversityTransportRetryOptions;
};

export type UniversityTransportFactory = (
  fixture: UniversityFixture,
  context: UniversityTransportContext,
) => UniversityTransport;

export type UniversityTransportFactoryByMode = {
  [mode in UniversityTransportMode]: UniversityTransportFactory;
};

export type UniversityScenarioStepLog = {
  step: string;
  request: unknown;
  response: unknown;
  checks: string[];
  proofPlaceholders?: string[];
  didBindingChecks?: string[];
  involvedDids: string[];
  latencyMs: number;
  stepId: string;
  requestId: string;
  requestHash: string;
  responseHash: string;
  startedAt: string;
  endedAt: string;
  transportChecks?: string[];
};

export type UniversityScenarioReplayStep = {
  step: string;
  stepId: string;
  requestId: string;
  requestHash: string;
  responseHash: string;
  proofPlaceholders?: string[];
  didBindingChecks?: string[];
  startedAt: string;
  endedAt: string;
  latencyMs: number;
  involvedDids: string[];
};

export type UniversityScenarioReplayArtifact = {
  artifactVersion: string;
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

export type UniversityScenarioFilter = {
  studentIds?: string[];
  companyIds?: string[];
};

export type UniversityScenarioReportArtifact = Omit<
  UniversityScenarioResult,
  "credentials"
> & {
  artifactVersion: string;
};

export type UniversityScenarioReplayResult = UniversityScenarioReplayArtifact;
