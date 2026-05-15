import { createHash } from "node:crypto";

export const assertPlainObject = (
  value: unknown,
  label: string,
): Record<string, unknown> => {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid university fixture format: ${label}`);
  }
  return value as Record<string, unknown>;
};

export const assertRequiredString = (
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

export const assertRequiredNumber = (value: unknown, label: string): number => {
  if (
    typeof value !== "number" ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    throw new Error(`Invalid university fixture format: ${label}`);
  }
  return value;
};

export const parseIso = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }
  return parsed.toISOString();
};

export const canonicalStringify = (value: unknown): string => {
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

export const hashPayload = (value: unknown): string => {
  const payload = canonicalStringify(value);
  return createHash("sha256").update(payload).digest("hex");
};

export const toStepId = (stepIndex: number, label: string): string => {
  const safeLabel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${String(stepIndex + 1).padStart(2, "0")}-${safeLabel}`;
};

export const waitMs = (value: number): Promise<void> => {
  if (value <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, value));
};

export const normalizeIdList = (values?: string[]): string[] | undefined => {
  if (values == null || values.length === 0) {
    return undefined;
  }

  const normalized = Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
  return normalized.length === 0 ? undefined : normalized;
};

export const assertIdentifiersExist = (
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
