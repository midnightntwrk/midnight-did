import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TRUST_ROLE_ISSUER = "issuer";
export const TRUST_ROLE_VERIFIER = "verifier";
export const TRUST_ROLE_PATTERN = /^(issuer|verifier)$/;
export const TRUST_DID_PATTERN = /^did:[a-z0-9][a-z0-9._-]*:.+$/i;

export type TrustRole = "issuer" | "verifier";
export type TrustRoleAction = "grant" | "revoke";

export type TrustRoleGrant = {
  role: TrustRole;
  partyDid: string;
  actorDid: string;
  action: "grant";
  effectiveAt: string;
  expiresAt?: string;
  reason?: string;
};

export type TrustRoleRevoke = {
  role: TrustRole;
  partyDid: string;
  actorDid: string;
  action: "revoke";
  effectiveAt: string;
  reason?: string;
};

export type TrustRoleEvent = TrustRoleGrant | TrustRoleRevoke;

export type TrustRegistryState = {
  registryId: string;
  updatedAt: string;
  events: TrustRoleEvent[];
};

export type TrustRoleDecision = {
  role: TrustRole;
  partyDid: string;
  isActive: boolean;
  activeFrom?: string;
  activeUntil?: string;
  reason: string;
  currentEvent?: TrustRoleEvent;
};

export type TrustRoleHistoryQuery = {
  role: TrustRole;
  partyDid: string;
};

export class TrustRoleTransitionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TrustRoleTransitionError";
  }
}

const parseTimestamp = (value: string, field: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new TrustRoleTransitionError(`Invalid ${field} timestamp: ${value}`);
  }
  return parsed;
};

const validateDid = (value: string, field: string): void => {
  if (!TRUST_DID_PATTERN.test(value)) {
    throw new TrustRoleTransitionError(`Invalid ${field}: ${value}`);
  }
};

const normalizeRegistryState = (
  state: TrustRegistryState,
): TrustRegistryState => {
  const sorted = [...state.events].sort((left, right) => {
    return (
      new Date(right.effectiveAt).getTime() -
      new Date(left.effectiveAt).getTime()
    );
  });
  const newest = sorted.length > 0 ? sorted.at(0) : undefined;

  return {
    registryId: state.registryId,
    updatedAt: newest?.effectiveAt ?? state.updatedAt,
    events: [...state.events],
  };
};

const validateEvent = (event: TrustRoleEvent): void => {
  validateDid(event.partyDid, "partyDid");
  validateDid(event.actorDid, "actorDid");
  if (!TRUST_ROLE_PATTERN.test(event.role)) {
    throw new TrustRoleTransitionError(`Invalid role: ${event.role}`);
  }
  parseTimestamp(event.effectiveAt, "effectiveAt");

  if (event.action === "grant" && event.expiresAt != null) {
    const effectiveAt = parseTimestamp(event.effectiveAt, "effectiveAt");
    const expiresAt = parseTimestamp(event.expiresAt, "expiresAt");
    if (expiresAt.getTime() <= effectiveAt.getTime()) {
      throw new TrustRoleTransitionError("expiresAt must be after effectiveAt");
    }
  }
};

export const applyTrustRoleTransition = (
  registry: TrustRegistryState,
  event: TrustRoleEvent,
): TrustRegistryState => {
  validateEvent(event);
  return normalizeRegistryState({
    ...registry,
    updatedAt: event.effectiveAt,
    events: [...registry.events, event],
  });
};

export const getTrustRoleHistory = (
  registry: TrustRegistryState,
  query: TrustRoleHistoryQuery,
): TrustRoleEvent[] => {
  return registry.events
    .filter(
      (event) => event.role === query.role && event.partyDid === query.partyDid,
    )
    .sort((left, right) => {
      return (
        parseTimestamp(left.effectiveAt, "effectiveAt").getTime() -
        parseTimestamp(right.effectiveAt, "effectiveAt").getTime()
      );
    });
};

export const evaluateTrustRole = (
  registry: TrustRegistryState,
  query: TrustRoleHistoryQuery,
  at?: string | Date,
): TrustRoleDecision => {
  const decisionTime = at == null ? new Date() : new Date(at);
  if (Number.isNaN(decisionTime.valueOf())) {
    throw new TrustRoleTransitionError(
      `Invalid decision timestamp: ${String(at)}`,
    );
  }

  const history = getTrustRoleHistory(registry, query);
  if (history.length === 0) {
    return {
      role: query.role,
      partyDid: query.partyDid,
      isActive: false,
      reason: "no role event found for this party",
    };
  }

  const snapshotHistory = history.filter((event) => {
    return (
      parseTimestamp(event.effectiveAt, "effectiveAt").getTime() <=
      decisionTime.getTime()
    );
  });

  if (snapshotHistory.length === 0) {
    return {
      role: query.role,
      partyDid: query.partyDid,
      isActive: false,
      reason: "no role event effective at this time",
      currentEvent: history.at(-1),
    };
  }

  const latest = snapshotHistory.at(-1)!;

  if (latest.action === "revoke") {
    return {
      role: query.role,
      partyDid: query.partyDid,
      isActive: false,
      reason: `role revoked at ${latest.effectiveAt} by ${latest.actorDid}`,
      currentEvent: latest,
    };
  }

  if (latest.action === "grant") {
    if (latest.expiresAt != null) {
      const expiry = parseTimestamp(latest.expiresAt, "expiresAt");
      if (decisionTime > expiry) {
        return {
          role: query.role,
          partyDid: query.partyDid,
          isActive: false,
          reason: `grant expired at ${latest.expiresAt}`,
          currentEvent: latest,
        };
      }
      return {
        role: query.role,
        partyDid: query.partyDid,
        isActive: true,
        activeFrom: latest.effectiveAt,
        activeUntil: latest.expiresAt,
        reason: `active grant by ${latest.actorDid}`,
        currentEvent: latest,
      };
    }

    return {
      role: query.role,
      partyDid: query.partyDid,
      isActive: true,
      activeFrom: latest.effectiveAt,
      reason: `active grant by ${latest.actorDid}`,
      currentEvent: latest,
    };
  }

  return {
    role: query.role,
    partyDid: query.partyDid,
    isActive: false,
    reason: "no grant found for active window",
    currentEvent: latest,
  };
};

export const assertTrustRoleActive = (
  registry: TrustRegistryState,
  query: TrustRoleHistoryQuery,
  at?: string | Date,
): TrustRoleDecision => {
  const decision = evaluateTrustRole(registry, query, at);
  if (!decision.isActive) {
    throw new TrustRoleTransitionError(
      `Role not active: role=${query.role}, partyDid=${query.partyDid}, reason=${decision.reason}`,
    );
  }
  return decision;
};

export const loadTrustRegistryFromFile = (
  fixturePath: string,
): TrustRegistryState => {
  if (!existsSync(fixturePath)) {
    throw new Error(`Trust registry fixture missing: ${fixturePath}`);
  }

  const raw = readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(raw) as TrustRegistryState;
  if (
    typeof parsed.registryId !== "string" ||
    typeof parsed.updatedAt !== "string" ||
    !Array.isArray(parsed.events)
  ) {
    throw new Error(`Invalid trust registry fixture format: ${fixturePath}`);
  }
  parsed.events.forEach((event) => validateEvent(event));
  return parsed;
};

export const trustRegistryFixturePath = (filename: string): string => {
  return path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "test/fixtures/trust-registry",
    filename,
  );
};
