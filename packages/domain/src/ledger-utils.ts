import {
  normalizeServiceEndpoint,
  type ServiceEndpoint,
  ServiceEndpointSchema,
} from "./did-document.js";
import { resolveDIDURLReference } from "./did-url.js";

export type BoundIdField =
  | "verificationMethod.id"
  | "schnorrJubjubVerificationMethod.id"
  | "service.id"
  | "methodId"
  | "serviceId";

export const normalizeFragmentId = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) return trimmed;
  const hashIndex = trimmed.lastIndexOf("#");
  if (hashIndex >= 0) return `#${trimmed.slice(hashIndex + 1)}`;
  return `#${trimmed}`;
};

/**
 * Resolve an identifier against the current DID without dropping path, query,
 * or fragment components. The historical name is retained for API callers;
 * its value is now the complete canonical absolute URL.
 */
export const normalizeBoundDIDURL = (
  value: string,
  field: BoundIdField,
  expectedDidSubject: string,
): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} must not be empty`);
  }
  if (trimmed.endsWith("#")) {
    throw new Error(`${field} must include a non-empty fragment identifier`);
  }
  try {
    const resolved = resolveDIDURLReference(trimmed, expectedDidSubject, {
      caseInsensitiveDIDSubject: true,
    });
    if (
      (field === "service.id" || field === "serviceId") &&
      resolved === expectedDidSubject
    ) {
      throw new Error(`${field} must identify a service`);
    }
    return resolved;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${field} ${error.message}`);
    }
    throw error;
  }
};

export const normalizeBoundFragmentId = (
  value: string,
  field: BoundIdField,
  expectedDidSubject: string,
): string => {
  const trimmed = value.trim();
  const isBareLabel =
    !trimmed.includes("#") &&
    !trimmed.startsWith("/") &&
    !trimmed.startsWith(".") &&
    !trimmed.startsWith("?") &&
    !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(trimmed);
  const resolved = normalizeBoundDIDURL(
    isBareLabel ? `#${trimmed}` : trimmed,
    field,
    expectedDidSubject,
  );
  if (!resolved.includes("#")) {
    throw new Error(`${field} must include a non-empty fragment identifier`);
  }
  if (
    !resolved.startsWith(`${expectedDidSubject}#`) &&
    !resolved.startsWith(`${expectedDidSubject}/`) &&
    !resolved.startsWith(`${expectedDidSubject}?`)
  ) {
    throw new Error(`${field} must be bound to the current DID`);
  }
  return resolved;
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
