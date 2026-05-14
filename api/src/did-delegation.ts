import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DELEGATION_TEMPLATE_VERSION = "v1";
export const DELEGATION_DID_PATTERN = /^did:[a-z0-9][a-z0-9._-]*:.+$/i;
export const DELEGATION_RELATIONSHIPS = [
  "capabilityInvocation",
  "capabilityDelegation",
] as const;

// Trust boundary: this module is a deterministic local projection for
// delegation templates and accepted delegation events. It validates event
// shape, timing, and state transitions, but it does not authenticate event
// signatures. Callers must feed only events that were already accepted by the
// Compact/on-chain authorization layer or a DID-signature verifier.

export type DelegationRelationship = (typeof DELEGATION_RELATIONSHIPS)[number];
export type DelegationActorType = "agent" | "service";
export type DelegationAction = "grant" | "revoke" | "rotate";

export type DelegationTemplate = {
  templateVersion: string;
  templateId: string;
  delegatorDid: string;
  delegateDid: string;
  delegateType: DelegationActorType;
  relationship: DelegationRelationship;
  verificationMethod: string;
  allowedOperations: string[];
  actorDid: string;
  serviceEndpoint?: string;
  validFrom: string;
  validUntil?: string;
  issuedAt?: string;
  notes?: string;
};

export type DelegationGrantEvent = {
  action: "grant";
  templateId: string;
  delegatorDid: string;
  delegateDid: string;
  actorDid: string;
  relationship: DelegationRelationship;
  verificationMethod: string;
  effectiveAt: string;
  expiresAt?: string;
  reason?: string;
};

export type DelegationRevokeEvent = {
  action: "revoke";
  delegatorDid: string;
  delegateDid: string;
  actorDid: string;
  relationship: DelegationRelationship;
  verificationMethod: string;
  effectiveAt: string;
  reason?: string;
};

export type DelegationRotateEvent = {
  action: "rotate";
  delegatorDid: string;
  delegateDid: string;
  actorDid: string;
  relationship: DelegationRelationship;
  verificationMethod: string;
  replacementVerificationMethod: string;
  effectiveAt: string;
  reason?: string;
};

export type DelegationEvent =
  | DelegationGrantEvent
  | DelegationRevokeEvent
  | DelegationRotateEvent;

export type DelegationState = {
  registryId: string;
  updatedAt: string;
  events: DelegationEvent[];
};

export type DelegationHistoryQuery = {
  delegatorDid: string;
  delegateDid: string;
  relationship: DelegationRelationship;
  verificationMethod?: string;
};

export type DelegationDecision = {
  delegatorDid: string;
  delegateDid: string;
  relationship: DelegationRelationship;
  isActive: boolean;
  activeVerificationMethods: string[];
  validFrom?: string;
  validUntil?: string;
  reason: string;
  currentEvent?: DelegationEvent;
};

export type DelegationRotationInput = {
  delegatorDid: string;
  delegateDid: string;
  actorDid: string;
  relationship: DelegationRelationship;
  fromVerificationMethod: string;
  toVerificationMethod: string;
  effectiveAt: string;
  reason?: string;
};

export class DelegationTemplateError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DelegationTemplateError";
  }
}

const parseTimestamp = (value: string, field: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new DelegationTemplateError(`Invalid ${field} timestamp: ${value}`);
  }
  return parsed;
};

const normalizeDid = (did: string, field: string): void => {
  if (!DELEGATION_DID_PATTERN.test(did)) {
    throw new DelegationTemplateError(`Invalid ${field}: ${did}`);
  }
};

const normalizeFragmentForOwner = (
  verificationMethod: string,
  ownerDid: string,
): string => {
  if (verificationMethod.startsWith("#")) {
    if (verificationMethod.length <= 1) {
      throw new DelegationTemplateError(
        `Invalid verificationMethod fragment: ${verificationMethod}`,
      );
    }
    return verificationMethod;
  }

  if (
    !verificationMethod.startsWith(`${ownerDid}#`) &&
    !verificationMethod.includes("#")
  ) {
    throw new DelegationTemplateError(
      `Invalid verificationMethod fragment: ${verificationMethod}`,
    );
  }

  if (!verificationMethod.startsWith(`${ownerDid}#`)) {
    throw new DelegationTemplateError(
      `verificationMethod must be owned by ${ownerDid}: ${verificationMethod}`,
    );
  }

  const [, fragment] = verificationMethod.split("#", 2);
  if (!fragment) {
    throw new DelegationTemplateError(
      `Invalid verificationMethod fragment: ${verificationMethod}`,
    );
  }
  return `#${fragment}`;
};

const validateAction = (event: DelegationEvent): void => {
  normalizeDid(event.delegatorDid, "delegatorDid");
  normalizeDid(event.delegateDid, "delegateDid");
  normalizeDid(event.actorDid, "actorDid");
  if (!DELEGATION_RELATIONSHIPS.includes(event.relationship)) {
    throw new DelegationTemplateError(
      `Invalid relationship: ${event.relationship}`,
    );
  }
  parseTimestamp(event.effectiveAt, "effectiveAt");

  switch (event.action) {
    case "grant": {
      if (event.expiresAt != null) {
        const start = parseTimestamp(event.effectiveAt, "effectiveAt");
        const expire = parseTimestamp(event.expiresAt, "expiresAt");
        if (expire.getTime() <= start.getTime()) {
          throw new DelegationTemplateError(
            "grant.expiresAt must be after grant.effectiveAt",
          );
        }
      }
      break;
    }
    case "revoke":
      if (event.verificationMethod == null) {
        throw new DelegationTemplateError(
          "revoke event must include verificationMethod",
        );
      }
      break;
    case "rotate":
      if (
        event.verificationMethod == null ||
        event.replacementVerificationMethod == null
      ) {
        throw new DelegationTemplateError(
          "rotate event requires verificationMethod and replacementVerificationMethod",
        );
      }
      if (event.verificationMethod === event.replacementVerificationMethod) {
        throw new DelegationTemplateError(
          "rotate verificationMethod and replacementVerificationMethod must differ",
        );
      }
      break;
    default:
      throw new DelegationTemplateError(
        `Unsupported action: ${(event as { action: string }).action}`,
      );
  }
};

const normalizeEvent = (event: DelegationEvent): DelegationEvent => {
  if (event.action === "rotate") {
    return {
      ...event,
      verificationMethod: normalizeFragmentForOwner(
        event.verificationMethod,
        event.delegatorDid,
      ),
      replacementVerificationMethod: normalizeFragmentForOwner(
        event.replacementVerificationMethod,
        event.delegatorDid,
      ),
    };
  }

  return {
    ...event,
    verificationMethod: normalizeFragmentForOwner(
      event.verificationMethod,
      event.delegatorDid,
    ),
  };
};

const isEffectivelyActive = (at: Date, expiresAt?: string): boolean => {
  if (expiresAt == null) {
    return true;
  }
  // expiresAt is an exclusive boundary: a delegation is inactive at the exact expiry instant.
  return at.getTime() < parseTimestamp(expiresAt, "expiresAt").getTime();
};

export const buildDelegationTemplate = (
  template: Omit<DelegationTemplate, "templateVersion">,
): DelegationTemplate => {
  normalizeDid(template.delegatorDid, "delegatorDid");
  normalizeDid(template.delegateDid, "delegateDid");
  normalizeDid(template.actorDid, "actorDid");

  if (
    template.allowedOperations == null ||
    template.allowedOperations.length === 0 ||
    template.allowedOperations.some((operation) => operation.trim() === "")
  ) {
    throw new DelegationTemplateError(
      "allowedOperations must include at least one non-empty operation",
    );
  }
  if (!DELEGATION_RELATIONSHIPS.includes(template.relationship)) {
    throw new DelegationTemplateError(
      `Invalid relationship: ${template.relationship}`,
    );
  }

  const normalizedMethod = normalizeFragmentForOwner(
    template.verificationMethod,
    template.delegatorDid,
  );
  parseTimestamp(template.validFrom, "validFrom");
  if (template.validUntil != null) {
    const validFrom = parseTimestamp(template.validFrom, "validFrom");
    const validUntil = parseTimestamp(template.validUntil, "validUntil");
    if (validUntil.getTime() <= validFrom.getTime()) {
      throw new DelegationTemplateError("validUntil must be after validFrom");
    }
  }

  return {
    templateVersion: DELEGATION_TEMPLATE_VERSION,
    ...template,
    verificationMethod: normalizedMethod,
    issuedAt: template.issuedAt ?? new Date().toISOString(),
  };
};

export const templateToGrantEvent = (
  template: DelegationTemplate,
  overrides?: Partial<Pick<DelegationGrantEvent, "effectiveAt" | "reason">>,
): DelegationGrantEvent => {
  return {
    action: "grant",
    templateId: template.templateId,
    delegatorDid: template.delegatorDid,
    delegateDid: template.delegateDid,
    actorDid: template.actorDid,
    relationship: template.relationship,
    verificationMethod: template.verificationMethod,
    effectiveAt: overrides?.effectiveAt ?? template.validFrom,
    expiresAt: template.validUntil,
    reason: overrides?.reason,
  };
};

export const applyDelegationTransition = (
  state: DelegationState,
  event: DelegationEvent,
): DelegationState => {
  validateAction(event);
  const canonical = normalizeEvent(event);
  return {
    registryId: state.registryId,
    updatedAt: event.effectiveAt,
    events: [...state.events, canonical],
  };
};

const sortedByTime = (events: DelegationEvent[]): DelegationEvent[] =>
  [...events].sort((left, right) => {
    const leftAt = parseTimestamp(left.effectiveAt, "effectiveAt").getTime();
    const rightAt = parseTimestamp(right.effectiveAt, "effectiveAt").getTime();
    if (leftAt !== rightAt) {
      return leftAt - rightAt;
    }
    return events.indexOf(left) - events.indexOf(right);
  });

export const getDelegationHistory = (
  state: DelegationState,
  query: DelegationHistoryQuery,
): DelegationEvent[] => {
  if (query.verificationMethod != null) {
    const normalizedQueryVerificationMethod = normalizeFragmentForOwner(
      query.verificationMethod,
      query.delegatorDid,
    );
    return sortedByTime(
      state.events.filter((event) => {
        if (
          event.delegatorDid !== query.delegatorDid ||
          event.delegateDid !== query.delegateDid ||
          event.relationship !== query.relationship
        ) {
          return false;
        }
        return (
          event.verificationMethod === normalizedQueryVerificationMethod ||
          (event.action === "rotate" &&
            event.replacementVerificationMethod ===
              normalizedQueryVerificationMethod)
        );
      }),
    );
  }

  return sortedByTime(
    state.events.filter((event) => {
      return (
        event.delegatorDid === query.delegatorDid &&
        event.delegateDid === query.delegateDid &&
        event.relationship === query.relationship
      );
    }),
  );
};

export const evaluateDelegation = (
  state: DelegationState,
  query: DelegationHistoryQuery,
  at?: string | Date,
): DelegationDecision => {
  const decisionTime = at == null ? new Date() : new Date(at);
  if (Number.isNaN(decisionTime.valueOf())) {
    throw new DelegationTemplateError(`Invalid evaluation time: ${String(at)}`);
  }

  const history = getDelegationHistory(state, {
    delegatorDid: query.delegatorDid,
    delegateDid: query.delegateDid,
    relationship: query.relationship,
  });

  const eventsBeforeTime = history.filter(
    (event) =>
      parseTimestamp(event.effectiveAt, "effectiveAt").getTime() <=
      decisionTime.getTime(),
  );

  const normalizedMethod =
    query.verificationMethod == null
      ? undefined
      : normalizeFragmentForOwner(query.verificationMethod, query.delegatorDid);

  const activeMethods = new Map<
    string,
    {
      grantedAt: string;
      expiresAt?: string;
    }
  >();

  const purgeExpiredMethods = (): void => {
    const expiryEntries = [...activeMethods.entries()];
    for (const [method, details] of expiryEntries) {
      if (!isEffectivelyActive(decisionTime, details.expiresAt)) {
        activeMethods.delete(method);
      }
    }
  };

  for (const event of sortedByTime(eventsBeforeTime)) {
    purgeExpiredMethods();

    if (
      event.relationship !== query.relationship ||
      event.delegateDid !== query.delegateDid ||
      event.delegatorDid !== query.delegatorDid
    ) {
      continue;
    }

    if (event.action === "grant") {
      activeMethods.set(event.verificationMethod, {
        grantedAt: event.effectiveAt,
        expiresAt: event.expiresAt,
      });
      continue;
    }

    if (event.action === "revoke") {
      activeMethods.delete(event.verificationMethod);
      continue;
    }

    if (event.action === "rotate") {
      const previousGrant = activeMethods.get(event.verificationMethod);
      activeMethods.delete(event.verificationMethod);
      if (previousGrant != null) {
        activeMethods.set(event.replacementVerificationMethod, {
          grantedAt: event.effectiveAt,
          expiresAt: previousGrant.expiresAt,
        });
      }
      continue;
    }
  }

  purgeExpiredMethods();

  const nowActive =
    normalizedMethod == null
      ? activeMethods.size > 0
      : activeMethods.has(normalizedMethod);

  if (!nowActive) {
    return {
      delegatorDid: query.delegatorDid,
      delegateDid: query.delegateDid,
      relationship: query.relationship,
      isActive: false,
      activeVerificationMethods: [],
      reason: normalizedMethod
        ? `No active method for ${query.delegateDid} on ${query.relationship} using ${normalizedMethod}`
        : `No active delegated verification methods for ${query.delegateDid} on ${query.relationship}`,
      currentEvent: eventsBeforeTime.at(-1),
    };
  }

  const activeEntries =
    normalizedMethod == null
      ? [...activeMethods.entries()]
      : [...activeMethods.entries()].filter(
          ([method]) => method === normalizedMethod,
        );
  const methods = activeEntries.map(([method]) => method);
  const oldest = activeEntries.reduce<string | undefined>(
    (earliest, [, details]) => {
      if (earliest == null) {
        return details.grantedAt;
      }
      return new Date(details.grantedAt).getTime() <
        new Date(earliest).getTime()
        ? details.grantedAt
        : earliest;
    },
    undefined,
  );

  const earliestExpiry = activeEntries.reduce<string | undefined>(
    (minExpiry, [, details]) => {
      if (details.expiresAt == null) {
        return minExpiry;
      }
      if (minExpiry == null) {
        return details.expiresAt;
      }
      return new Date(details.expiresAt).getTime() <
        new Date(minExpiry).getTime()
        ? details.expiresAt
        : minExpiry;
    },
    undefined,
  );

  return {
    delegatorDid: query.delegatorDid,
    delegateDid: query.delegateDid,
    relationship: query.relationship,
    isActive: true,
    activeVerificationMethods: methods,
    validFrom: oldest,
    validUntil: earliestExpiry,
    reason:
      normalizedMethod == null
        ? `active delegated methods: ${methods.join(", ")}`
        : `active delegated method ${normalizedMethod}`,
    currentEvent: eventsBeforeTime.at(-1),
  };
};

export const assertDelegationActive = (
  state: DelegationState,
  query: DelegationHistoryQuery,
  at?: string | Date,
): DelegationDecision => {
  const decision = evaluateDelegation(state, query, at);
  if (!decision.isActive) {
    throw new DelegationTemplateError(
      `Delegation inactive: delegatorDid=${query.delegatorDid}, delegateDid=${query.delegateDid}, relationship=${query.relationship}, reason=${decision.reason}`,
    );
  }
  return decision;
};

export const rotateDelegationKey = (
  state: DelegationState,
  input: DelegationRotationInput,
): DelegationState => {
  const normalizedFrom = normalizeFragmentForOwner(
    input.fromVerificationMethod,
    input.delegatorDid,
  );
  const normalizedTo = normalizeFragmentForOwner(
    input.toVerificationMethod,
    input.delegatorDid,
  );
  if (normalizedFrom === normalizedTo) {
    throw new DelegationTemplateError(
      "rotation source and destination are equal",
    );
  }

  const active = evaluateDelegation(
    state,
    {
      delegatorDid: input.delegatorDid,
      delegateDid: input.delegateDid,
      relationship: input.relationship,
      verificationMethod: normalizedFrom,
    },
    input.effectiveAt,
  );
  if (!active.isActive) {
    throw new DelegationTemplateError(
      `Cannot rotate inactive method ${normalizedFrom} at ${input.effectiveAt}`,
    );
  }

  return applyDelegationTransition(state, {
    action: "rotate",
    delegatorDid: input.delegatorDid,
    delegateDid: input.delegateDid,
    actorDid: input.actorDid,
    relationship: input.relationship,
    verificationMethod: normalizedFrom,
    replacementVerificationMethod: normalizedTo,
    effectiveAt: input.effectiveAt,
    reason: input.reason,
  });
};

export const loadDelegationStateFromFile = (
  fixturePath: string,
): DelegationState => {
  if (!existsSync(fixturePath)) {
    throw new DelegationTemplateError(
      `Delegation fixture missing: ${fixturePath}`,
    );
  }
  const raw = readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(raw) as DelegationState;
  if (
    typeof parsed.registryId !== "string" ||
    typeof parsed.updatedAt !== "string" ||
    !Array.isArray(parsed.events)
  ) {
    throw new DelegationTemplateError(
      `Invalid delegation fixture format: ${fixturePath}`,
    );
  }
  parsed.events = parsed.events.map((event) => {
    validateAction(event);
    return normalizeEvent(event);
  });
  return parsed;
};

export const loadDelegationTemplateFromFile = (
  fixturePath: string,
): DelegationTemplate => {
  if (!existsSync(fixturePath)) {
    throw new DelegationTemplateError(
      `Delegation template fixture missing: ${fixturePath}`,
    );
  }
  const raw = readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(raw) as Omit<DelegationTemplate, "templateVersion">;
  return buildDelegationTemplate(parsed);
};

export const delegationTemplateFixturePath = (filename: string): string => {
  return path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "test/fixtures/delegation",
    filename,
  );
};
