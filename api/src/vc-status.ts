import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

export const loadVcStatusRegistryFromFile = (
  fixturePath: string,
): VcStatusRegistry => {
  if (!existsSync(fixturePath)) {
    throw new Error(`Status registry fixture missing: ${fixturePath}`);
  }
  const raw = readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(raw) as VcStatusRegistry;

  if (
    typeof parsed.statusRef !== "string" ||
    typeof parsed.statusPurpose !== "string" ||
    typeof parsed.issuedAt !== "string" ||
    typeof parsed.credentials !== "object" ||
    parsed.credentials == null
  ) {
    throw new Error(`Invalid status registry fixture format: ${fixturePath}`);
  }

  if (!VC_STATUS_ENTRY_PATTERN.test(parsed.statusRef)) {
    throw new Error(
      "status registry statusRef does not match reference pattern",
    );
  }
  for (const [statusEntry, entry] of Object.entries(parsed.credentials)) {
    if (!VC_STATUS_ENTRY_PATTERN.test(statusEntry)) {
      throw new Error(
        `status registry entry does not match reference pattern: ${statusEntry}`,
      );
    }
    if (entry.state !== "active" && entry.state !== "revoked") {
      throw new Error(`Invalid status registry entry state: ${statusEntry}`);
    }
  }

  return parsed;
};

export const statusRegistryFixturePath = (filename: string): string => {
  return path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "test/fixtures/vc-status",
    filename,
  );
};
