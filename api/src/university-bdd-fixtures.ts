import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
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
  UNIVERSITY_DID_TRUST_EVENT_NAMESPACE_PREFIXES,
  type UniversityFixture,
  type UniversityFixtureCompany,
  type UniversityFixtureGeneratorOptions,
  type UniversityFixtureMall,
  type UniversityFixtureShrinkOptions,
  type UniversityFixtureStudent,
  type UniversityFixtureSubsetOptions,
  type UniversityFixtureUniversity,
  type UniversityRole,
} from "./university-bdd-types";
import {
  assertIdentifiersExist,
  assertPlainObject,
  assertRequiredNumber,
  assertRequiredString,
  normalizeIdList,
  parseIso,
} from "./university-bdd-utils";
import type { VcStatusRegistry } from "./vc-status";

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
        UNIVERSITY_DID_TRUST_EVENT_NAMESPACE_PREFIXES,
      ),
      actorDid: assertDidNamespace(
        normalizeDid(raw.actorDid, `trustRegistry.events[${index}].actorDid`),
        `trustRegistry.events[${index}].actorDid`,
        UNIVERSITY_DID_TRUST_EVENT_NAMESPACE_PREFIXES,
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

const generateUniversityEntityDid = (
  namespace: string,
  seed: number,
  index: number,
): string => {
  return `did:midnight:${namespace}:seed-${seed.toString(16)}-${String(index).padStart(3, "0")}`;
};

// Generated fixtures keep institutional DIDs stable so cross-seed reports stay comparable.
const GENERATED_UNIVERSITY_DID = "did:midnight:edu:midnight-state-university";
const GENERATED_MALL_DID = "did:midnight:org:midnight-state-mall";

const generateUniversityId = (prefix: string, index: number): string => {
  return `${prefix}${String(index).padStart(3, "0")}`;
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

  const gradeFloor = toPositiveInteger(options.gradeFloor ?? 60, "gradeFloor");
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
        partyDid: GENERATED_UNIVERSITY_DID,
        actorDid: "did:midnight:gov:state-registry",
        action: "grant",
        effectiveAt: createdAt,
        reason: "University stress fixture issuance trust",
      },
      ...companies.map(
        (company): TrustRoleGrant => ({
          role: TRUST_ROLE_VERIFIER as TrustRole,
          partyDid: company.did,
          actorDid: GENERATED_UNIVERSITY_DID,
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
      did: GENERATED_UNIVERSITY_DID,
      name: "Midnight State University",
      issuerDid: "did:midnight:key:university-issuer",
      credentialStatusRef: statusRef,
    },
    students,
    companies,
    mall: {
      did: GENERATED_MALL_DID,
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
