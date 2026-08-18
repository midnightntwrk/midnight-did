import {
  normalizeServiceEndpoint,
  type ServiceEndpoint,
  ServiceEndpointSchema,
} from "./did-document.js";

export type BoundIdField =
  | "verificationMethod.id"
  | "schnorrJubjubVerificationMethod.id"
  | "service.id"
  | "methodId"
  | "serviceId";

const hasUriScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export const normalizeFragmentId = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) return trimmed;
  const hashIndex = trimmed.indexOf("#");
  if (hashIndex >= 0) return `#${trimmed.slice(hashIndex + 1)}`;
  return `#${trimmed}`;
};

export const normalizeBoundFragmentId = (
  value: string,
  field: BoundIdField,
  expectedDidSubject: string,
): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} must not be empty`);
  }
  if (trimmed.startsWith("//")) {
    throw new Error(`${field} must be a DID URL or relative reference`);
  }
  if (trimmed.startsWith("#")) {
    if (trimmed === "#") {
      throw new Error(`${field} must include a non-empty fragment identifier`);
    }
    return trimmed;
  }

  const hashIndex = trimmed.indexOf("#");
  if (trimmed.startsWith("did:")) {
    if (hashIndex <= 0 || hashIndex === trimmed.length - 1) {
      throw new Error(
        `${field} DID URL must include a non-empty fragment identifier`,
      );
    }
    const didSubject = trimmed.slice(0, hashIndex);
    if (didSubject !== expectedDidSubject) {
      throw new Error(
        `${field} DID URL subject must match the current DID (${expectedDidSubject})`,
      );
    }
    return `#${trimmed.slice(hashIndex + 1)}`;
  }

  if (hasUriScheme.test(trimmed)) {
    throw new Error(`${field} must be a DID URL or relative reference`);
  }
  const normalized = normalizeFragmentId(trimmed);
  if (normalized === "#") {
    throw new Error(`${field} must include a non-empty fragment identifier`);
  }
  return normalized;
};

export const serviceTypeToLedger = (serviceType: string | string[]): string => {
  if (typeof serviceType === "string") {
    const normalized = serviceType.trim();
    if (normalized.length === 0) {
      throw new Error("service type must not be empty");
    }
    return normalized;
  }
  if (!Array.isArray(serviceType) || serviceType.length === 0) {
    throw new Error("service type property must be a non-empty string set");
  }
  const normalized = serviceType.map((value) => value.trim());
  if (normalized.some((value) => value.length === 0)) {
    throw new Error("service type entries must not be empty");
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("service type entries must be unique");
  }
  return normalized.length === 1 ? normalized[0] : JSON.stringify(normalized);
};

export const serviceEndpointToLedger = (endpoint: unknown): string => {
  const parsed = ServiceEndpointSchema.parse(endpoint) as ServiceEndpoint;
  const normalized = normalizeServiceEndpoint(parsed);
  if (Array.isArray(normalized)) {
    const seen = new Set<string>();
    for (const entry of normalized) {
      const key = typeof entry === "string" ? entry : JSON.stringify(entry);
      if (seen.has(key)) {
        throw new Error("serviceEndpoint values must be unique");
      }
      seen.add(key);
    }
  }
  return JSON.stringify(normalized);
};

export const assertAbsoluteUri = (
  value: string,
  field = "aliasUri",
): string => {
  const alias = value.trim();
  if (alias.length === 0) {
    throw new Error(`${field} must not be empty`);
  }
  try {
    new URL(alias);
  } catch {
    throw new Error(`${field} must be a valid absolute URI (RFC3986)`);
  }
  return alias;
};
