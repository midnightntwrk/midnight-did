export type JsonRecord = Record<string, unknown>;
export type SchemaErrorFactory = (message: string) => Error;

const defaultErrorFactory: SchemaErrorFactory = (message) => new Error(message);

const describeJsonType = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

export const parsePersistedJson = (
  raw: string,
  source: string,
  createError: SchemaErrorFactory = defaultErrorFactory,
): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createError(`Invalid JSON in ${source}: ${message}`);
  }
};

export const assertPersistedRecord = (
  value: unknown,
  fieldPath: string,
  createError: SchemaErrorFactory = defaultErrorFactory,
): JsonRecord => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  throw createError(
    `${fieldPath} must be an object, got ${describeJsonType(value)}`,
  );
};

export const assertPersistedArray = (
  value: unknown,
  fieldPath: string,
  createError: SchemaErrorFactory = defaultErrorFactory,
): unknown[] => {
  if (Array.isArray(value)) return value;
  throw createError(
    `${fieldPath} must be an array, got ${describeJsonType(value)}`,
  );
};

export const assertPersistedString = (
  value: unknown,
  fieldPath: string,
  createError: SchemaErrorFactory = defaultErrorFactory,
  { allowEmpty = false }: { readonly allowEmpty?: boolean } = {},
): string => {
  if (typeof value !== "string") {
    throw createError(
      `${fieldPath} must be a string, got ${describeJsonType(value)}`,
    );
  }
  if (!allowEmpty && value.trim() === "") {
    throw createError(`${fieldPath} must be a non-empty string`);
  }
  return value;
};

export const assertPersistedIsoTimestamp = (
  value: unknown,
  fieldPath: string,
  createError: SchemaErrorFactory = defaultErrorFactory,
): string => {
  const timestamp = assertPersistedString(value, fieldPath, createError);
  if (Number.isNaN(new Date(timestamp).valueOf())) {
    throw createError(`${fieldPath} must be a valid ISO timestamp`);
  }
  return timestamp;
};

export const readRequiredString = (
  record: JsonRecord,
  fieldName: string,
  parentPath: string,
  createError: SchemaErrorFactory = defaultErrorFactory,
): string =>
  assertPersistedString(
    record[fieldName],
    `${parentPath}.${fieldName}`,
    createError,
  );

export const readOptionalString = (
  record: JsonRecord,
  fieldName: string,
  parentPath: string,
  createError: SchemaErrorFactory = defaultErrorFactory,
): string | undefined => {
  const value = record[fieldName];
  if (value == null) return undefined;
  return assertPersistedString(
    value,
    `${parentPath}.${fieldName}`,
    createError,
  );
};

export const readRequiredIsoTimestamp = (
  record: JsonRecord,
  fieldName: string,
  parentPath: string,
  createError: SchemaErrorFactory = defaultErrorFactory,
): string =>
  assertPersistedIsoTimestamp(
    record[fieldName],
    `${parentPath}.${fieldName}`,
    createError,
  );

export const readOptionalIsoTimestamp = (
  record: JsonRecord,
  fieldName: string,
  parentPath: string,
  createError: SchemaErrorFactory = defaultErrorFactory,
): string | undefined => {
  const value = record[fieldName];
  if (value == null) return undefined;
  return assertPersistedIsoTimestamp(
    value,
    `${parentPath}.${fieldName}`,
    createError,
  );
};

export const readRequiredRecord = (
  record: JsonRecord,
  fieldName: string,
  parentPath: string,
  createError: SchemaErrorFactory = defaultErrorFactory,
): JsonRecord =>
  assertPersistedRecord(
    record[fieldName],
    `${parentPath}.${fieldName}`,
    createError,
  );

export const readRequiredArray = (
  record: JsonRecord,
  fieldName: string,
  parentPath: string,
  createError: SchemaErrorFactory = defaultErrorFactory,
): unknown[] =>
  assertPersistedArray(
    record[fieldName],
    `${parentPath}.${fieldName}`,
    createError,
  );

export const readStringUnion = <Value extends string>(
  record: JsonRecord,
  fieldName: string,
  parentPath: string,
  allowedValues: readonly Value[],
  createError: SchemaErrorFactory = defaultErrorFactory,
): Value => {
  const value = readRequiredString(record, fieldName, parentPath, createError);
  if (allowedValues.includes(value as Value)) {
    return value as Value;
  }
  throw createError(
    `${parentPath}.${fieldName} must be one of: ${allowedValues.join(", ")}`,
  );
};
