import { createHash } from "node:crypto";

const DIGEST_ALGORITHM = "sha256";

export const SCHEMA_REGISTRY = {
  identity: {
    packageId: "did:midnight:compact",
    schemaId: "midnight-compact-identity",
    majorVersion: 1,
    minorVersion: 0,
    requiredClaims: [
      "subjectDid",
      "fullName",
      "nationality",
      "identityLevel",
    ],
  },
  role: {
    packageId: "did:midnight:compact",
    schemaId: "midnight-compact-role",
    majorVersion: 1,
    minorVersion: 0,
    requiredClaims: [
      "subjectDid",
      "roleCode",
      "issuerDid",
      "scope",
      "validFrom",
      "validTo",
    ],
  },
  compliance: {
    packageId: "did:midnight:compact",
    schemaId: "midnight-compact-compliance",
    majorVersion: 1,
    minorVersion: 0,
    requiredClaims: [
      "subjectDid",
      "providerDid",
      "jurisdiction",
      "scope",
      "issuedAt",
      "validUntil",
    ],
  },
};

export const CANONICAL_VERSION = 1;

export function normalizeCompactValue(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("hex");
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeCompactValue(entry));
  }

  return Object.entries(value)
    .sort(([lhs], [rhs]) => lhs.localeCompare(rhs))
    .reduce((acc, [key, entry]) => {
      acc[key] = normalizeCompactValue(entry);
      return acc;
    }, {});
}

export function stableCanonicalJson(payload) {
  return JSON.stringify(normalizeCompactValue(payload));
}

export function compactVcCanonicalDigest(payload, encoding = "hex") {
  const canonical = stableCanonicalJson(payload);
  return createHash(DIGEST_ALGORITHM).update(canonical, "utf8").digest(encoding);
}

export function assertRequiredClaims(schema, payload) {
  const schemaMeta = SCHEMA_REGISTRY[schema];
  if (!schemaMeta) {
    throw new Error(`Unknown schema key: ${schema}`);
  }

  const missingClaims = schemaMeta.requiredClaims.filter(
    (claim) => !Object.hasOwn(payload, claim),
  );
  if (missingClaims.length > 0) {
    throw new Error(`Missing claims for ${schema}: ${missingClaims.join(", ")}`);
  }
}

export function compactVcEnvelope({ schema, issuerDid, issuedAt, credential }) {
  assertRequiredClaims(schema, credential);
  return {
    version: CANONICAL_VERSION,
    schema: {
      packageId: SCHEMA_REGISTRY[schema].packageId,
      schemaId: SCHEMA_REGISTRY[schema].schemaId,
      majorVersion: SCHEMA_REGISTRY[schema].majorVersion,
      minorVersion: SCHEMA_REGISTRY[schema].minorVersion,
    },
    claims: {
      issuerDid,
      issuedAt,
      credential: normalizeCompactValue(credential),
    },
  };
}
