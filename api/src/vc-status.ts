import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertPersistedRecord,
  parsePersistedJson,
  readOptionalIsoTimestamp,
  readOptionalString,
  readRequiredIsoTimestamp,
  readRequiredRecord,
  readRequiredString,
  readStringUnion,
  type SchemaErrorFactory,
} from "./persisted-state-schema";

export const VC_STATUS_PURPOSE = "revocation";
export const VC_STATUS_TYPE = "MidnightStatusList";
export const VC_STATUS_ENTRY_PATTERN = /^urn:vc-status:[^\s]+$/i;

export type VcStatusState = "active" | "revoked" | "unknown";

export type VcStatusEntry = {
  state: "active" | "revoked";
  statusReason?: string;
  updatedAt?: string;
};

export type VcStatusRegistry = {
  statusRef: string;
  statusPurpose: string;
  issuedAt: string;
  credentials: Record<string, VcStatusEntry>;
};

export type VcStatusReference = {
  id: string;
  type: string;
  statusPurpose: string;
  statusRef: string;
};

export type VerifiableCredential = {
  id: string;
  credentialStatus?: VcStatusReference;
};

export type VcStatusDecision = {
  statusRef: string | undefined;
  statusEntry: string | undefined;
  state: VcStatusState;
  reason: string;
};

export class VcRevocationError extends Error {
  public statusRef: string | undefined;
  public statusEntry: string | undefined;
  public statusState = "revoked" as const;

  public constructor(
    credentialId: string,
    statusRef: string | undefined,
    statusEntry: string | undefined,
    detail?: string,
  ) {
    super(
      `Revoked credential rejected. credentialId=${credentialId}, statusRef=${statusRef ?? "unknown"}, statusEntry=${statusEntry ?? "unknown"}, ${detail ?? "state=revoked"}`,
    );
    this.name = "VcRevocationError";
    this.statusRef = statusRef;
    this.statusEntry = statusEntry;
  }
}

export class VcStatusUnavailableError extends Error {
  public statusRef: string | undefined;
  public statusEntry: string | undefined;
  public statusState = "unknown" as const;

  public constructor(
    credentialId: string,
    statusRef: string | undefined,
    statusEntry: string | undefined,
    detail: string,
  ) {
    super(
      `Credential status unavailable. credentialId=${credentialId}, statusRef=${statusRef ?? "unknown"}, statusEntry=${statusEntry ?? "unknown"}, ${detail}`,
    );
    this.name = "VcStatusUnavailableError";
    this.statusRef = statusRef;
    this.statusEntry = statusEntry;
  }
}

export class VcStatusRegistryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "VcStatusRegistryError";
  }
}

export const validateStatusReference = (
  credentialStatus: VcStatusReference,
): void => {
  if (
    typeof credentialStatus.id !== "string" ||
    credentialStatus.id.length === 0
  ) {
    throw new Error("Invalid credentialStatus.id");
  }

  if (
    typeof credentialStatus.type !== "string" ||
    credentialStatus.type.length === 0
  ) {
    throw new Error("Invalid credentialStatus.type");
  }

  if (!VC_STATUS_ENTRY_PATTERN.test(credentialStatus.statusRef)) {
    throw new Error(
      "credentialStatus.statusRef does not match reference pattern",
    );
  }

  if (
    typeof credentialStatus.statusPurpose !== "string" ||
    credentialStatus.statusPurpose.length === 0
  ) {
    throw new Error("Invalid credentialStatus.statusPurpose");
  }
};

const isStatusEnabled = (statusPurpose: string): boolean =>
  statusPurpose.toLowerCase() === VC_STATUS_PURPOSE;

export const evaluateVcStatus = (
  credential: VerifiableCredential,
  registry?: VcStatusRegistry,
): VcStatusDecision => {
  const status = credential.credentialStatus;
  if (!status) {
    return {
      statusRef: undefined,
      statusEntry: undefined,
      state: "unknown",
      reason: "no status reference found in credential",
    };
  }

  validateStatusReference(status);

  if (!isStatusEnabled(status.statusPurpose)) {
    return {
      statusRef: status.id,
      statusEntry: status.statusRef,
      state: "unknown",
      reason: `unsupported statusPurpose: ${status.statusPurpose}`,
    };
  }

  if (registry == null) {
    return {
      statusRef: status.id,
      statusEntry: status.statusRef,
      state: "unknown",
      reason: "registry unavailable; status check skipped (soft path)",
    };
  }

  if (registry.statusRef !== status.id) {
    return {
      statusRef: status.id,
      statusEntry: status.statusRef,
      state: "unknown",
      reason: `statusRef mismatch: credential ${status.id}, registry ${registry.statusRef}`,
    };
  }

  const state = registry.credentials[status.statusRef]?.state;
  if (state === undefined) {
    return {
      statusRef: status.id,
      statusEntry: status.statusRef,
      state: "unknown",
      reason: `no status entry in registry for ${status.statusRef}`,
    };
  }

  return {
    statusRef: status.id,
    statusEntry: status.statusRef,
    state,
    reason:
      state === "revoked" ? "revoked credential explicitly listed" : "active",
  };
};

export const assertVcNotRevoked = (
  credential: VerifiableCredential,
  registry?: VcStatusRegistry,
): VcStatusDecision => {
  const decision = evaluateVcStatus(credential, registry);
  if (decision.state === "revoked") {
    throw new VcRevocationError(
      credential.id,
      decision.statusRef,
      decision.statusEntry,
      decision.reason,
    );
  }
  if (decision.state === "unknown") {
    throw new VcStatusUnavailableError(
      credential.id,
      decision.statusRef,
      decision.statusEntry,
      decision.reason,
    );
  }
  return decision;
};

const createStatusRegistrySchemaError =
  (fixturePath: string): SchemaErrorFactory =>
  (message) =>
    new VcStatusRegistryError(
      `Invalid status registry fixture format: ${fixturePath}: ${message}`,
    );

const assertStatusReferencePattern = (
  value: string,
  fieldPath: string,
  createError: SchemaErrorFactory,
): void => {
  if (!VC_STATUS_ENTRY_PATTERN.test(value)) {
    throw createError(`${fieldPath} does not match reference pattern`);
  }
};

const normalizeStatusEntry = (
  value: unknown,
  fieldPath: string,
  createError: SchemaErrorFactory,
): VcStatusEntry => {
  const raw = assertPersistedRecord(value, fieldPath, createError);
  const state = readStringUnion(
    raw,
    "state",
    fieldPath,
    ["active", "revoked"] as const,
    createError,
  );
  const statusReason = readOptionalString(
    raw,
    "statusReason",
    fieldPath,
    createError,
  );
  const updatedAt = readOptionalIsoTimestamp(
    raw,
    "updatedAt",
    fieldPath,
    createError,
  );
  const entry: VcStatusEntry = { state };
  if (statusReason !== undefined) entry.statusReason = statusReason;
  if (updatedAt !== undefined) entry.updatedAt = updatedAt;
  return entry;
};

export const normalizeVcStatusRegistry = (
  value: unknown,
  {
    source = "status registry",
    createError = createStatusRegistrySchemaError(source),
  }: {
    readonly source?: string;
    readonly createError?: SchemaErrorFactory;
  } = {},
): VcStatusRegistry => {
  const raw = assertPersistedRecord(value, "statusRegistry", createError);
  const statusRef = readRequiredString(
    raw,
    "statusRef",
    "statusRegistry",
    createError,
  );
  assertStatusReferencePattern(
    statusRef,
    "statusRegistry.statusRef",
    createError,
  );

  const statusPurpose = readRequiredString(
    raw,
    "statusPurpose",
    "statusRegistry",
    createError,
  );
  const issuedAt = readRequiredIsoTimestamp(
    raw,
    "issuedAt",
    "statusRegistry",
    createError,
  );
  const credentials = readRequiredRecord(
    raw,
    "credentials",
    "statusRegistry",
    createError,
  );
  const normalizedCredentials: Record<string, VcStatusEntry> = {};

  for (const [statusEntry, entry] of Object.entries(credentials)) {
    assertStatusReferencePattern(
      statusEntry,
      `statusRegistry.credentials.${statusEntry}`,
      createError,
    );
    normalizedCredentials[statusEntry] = normalizeStatusEntry(
      entry,
      `statusRegistry.credentials.${statusEntry}`,
      createError,
    );
  }

  return {
    statusRef,
    statusPurpose,
    issuedAt,
    credentials: normalizedCredentials,
  };
};

export const loadVcStatusRegistryFromFile = (
  fixturePath: string,
): VcStatusRegistry => {
  if (!existsSync(fixturePath)) {
    throw new Error(`Status registry fixture missing: ${fixturePath}`);
  }
  const raw = readFileSync(fixturePath, "utf8");
  const createError = createStatusRegistrySchemaError(fixturePath);
  return normalizeVcStatusRegistry(
    parsePersistedJson(raw, fixturePath, createError),
    {
      createError,
      source: fixturePath,
    },
  );
};

export const statusRegistryFixturePath = (filename: string): string => {
  return path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "test/fixtures/vc-status",
    filename,
  );
};
