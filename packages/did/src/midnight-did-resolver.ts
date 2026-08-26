import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  type ContractAddress,
  DIDDocumentConsistencyError,
  type DIDDocumentMetadata,
  type DIDDocumentRepresentationMediaTypes,
  type DIDResolutionErrorCode,
  type KnownDIDResolutionErrorCode,
  parseMidnightDID,
  parseMidnightDIDString,
} from "@midnight-ntwrk/midnight-did-domain";
import { z } from "zod/v4-mini";

import {
  LedgerDocumentValidationError,
  LedgerToDomain,
} from "./ledger-to-domain.js";
import { MidnightNetwork } from "./midnight.js";
import { type MidnightDIDDocument } from "./midnight-did-document.js";

export type MidnightLedgerState = DIDContract.Ledger;

export type MidnightLedgerReader = (
  contractAddress: string,
) => Promise<MidnightLedgerState | null>;

export type MidnightDIDResolverOptions = {
  ledgerReader: MidnightLedgerReader;
  expectedNetwork?: MidnightNetwork;
};

export type MidnightResolutionResult = {
  didDocument: MidnightDIDDocument;
  didDocumentMetadata: DIDDocumentMetadata;
};

export type MidnightDIDResolutionResult = {
  didDocument: MidnightDIDDocument | null;
  didDocumentMetadata: DIDDocumentMetadata;
  didResolutionMetadata: {
    error?: DIDResolutionErrorCode;
  };
};

export type MidnightDIDResolutionOptions = {
  /** Requested DID Document representation media type(s). */
  accept?: string | readonly string[];
};

export type MidnightDIDRepresentationResult = {
  /** Null when resolution fails; otherwise the serialized DID Document. */
  didDocumentStream: Uint8Array | null;
  didDocumentMetadata: DIDDocumentMetadata;
  didResolutionMetadata: {
    contentType?: DIDDocumentRepresentationMediaTypes;
    error?: DIDResolutionErrorCode;
  };
};

export interface MidnightDIDResolverInterface {
  resolve(did: string): Promise<MidnightDIDDocument>;
  resolveResult(did: string): Promise<MidnightResolutionResult | null>;
  resolveDIDResolutionResult(did: string): Promise<MidnightDIDResolutionResult>;
  resolveRepresentation(
    did: string,
    options?: MidnightDIDResolutionOptions,
  ): Promise<MidnightDIDRepresentationResult>;
}

const resolutionEnvelope = (
  result: MidnightResolutionResult | null,
  error?: DIDResolutionErrorCode,
): MidnightDIDResolutionResult => ({
  didDocument: result?.didDocument ?? null,
  didDocumentMetadata: result?.didDocumentMetadata ?? {},
  didResolutionMetadata: error === undefined ? {} : { error },
});

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

type LedgerDocumentResolutionCode = Extract<
  KnownDIDResolutionErrorCode,
  | "invalidDid"
  | "notAllowedLocalDuplicateKey"
  | "notAllowedVerificationMethodType"
  | "invalidPublicKey"
>;

class InvalidDIDDocumentError extends Error {
  readonly resolutionCode: LedgerDocumentResolutionCode;

  constructor(
    error: unknown,
    resolutionCode: LedgerDocumentResolutionCode = "invalidDid",
  ) {
    super(errorMessage(error), { cause: error });
    this.name = "InvalidDIDDocumentError";
    this.resolutionCode = resolutionCode;
  }
}

class ResolverRequestError extends Error {
  readonly resolutionCode: Extract<
    KnownDIDResolutionErrorCode,
    "invalidDid" | "methodNotSupported"
  >;

  constructor(
    message: string,
    resolutionCode: ResolverRequestError["resolutionCode"],
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ResolverRequestError";
    this.resolutionCode = resolutionCode;
  }
}

/**
 * Classify only structured errors known to be caused by malformed ledger
 * document data. Unexpected exceptions deliberately remain internalError.
 */
const ledgerDocumentResolutionCode = (
  error: unknown,
): LedgerDocumentResolutionCode | null => {
  if (error instanceof LedgerDocumentValidationError) {
    return error.resolutionCode;
  }
  if (error instanceof DIDDocumentConsistencyError) {
    return error.issues.some(
      (issue) => issue.code === "duplicateVerificationMethod",
    )
      ? "notAllowedLocalDuplicateKey"
      : "invalidDid";
  }

  if (error instanceof z.core.$ZodError) {
    return error.issues.some((issue) =>
      issue.path?.some((segment) => segment === "publicKeyJwk"),
    )
      ? "invalidPublicKey"
      : "invalidDid";
  }
  return null;
};

const invalidDidDocumentError = (error: unknown): InvalidDIDDocumentError =>
  new InvalidDIDDocumentError(
    error,
    ledgerDocumentResolutionCode(error) ?? "invalidDid",
  );

const resolutionErrorCode = (error: unknown): DIDResolutionErrorCode => {
  if (
    error instanceof InvalidDIDDocumentError ||
    error instanceof ResolverRequestError
  ) {
    return error.resolutionCode;
  }
  return "internalError";
};

const supportedRepresentationMediaTypes: readonly DIDDocumentRepresentationMediaTypes[] =
  ["application/did+ld+json", "application/did+json"];

type AcceptMediaRange = {
  type: string;
  subtype: string;
  mediaParameterCount: number;
  quality: number;
  order: number;
};

const httpToken = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const httpQuality = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

/** Split an Accept list without treating quoted delimiters as separators. */
const splitOutsideQuotes = (
  value: string,
  separator: "," | ";",
): string[] | null => {
  const parts: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quoted = false;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === separator) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  if (quoted || escaped) return null;
  parts.push(value.slice(start));
  return parts;
};

const validParameterValue = (value: string): boolean => {
  if (httpToken.test(value)) return true;
  if (!value.startsWith('"') || !value.endsWith('"')) return false;

  let escaped = false;
  for (const character of value.slice(1, -1)) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isQuotedCharacter =
      codePoint === 9 ||
      (codePoint >= 32 && codePoint <= 126) ||
      (codePoint >= 128 && codePoint <= 255);
    if (!isQuotedCharacter || (!escaped && character === '"')) return false;
    if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    }
  }
  return !escaped;
};

const parseAcceptMediaRange = (
  value: string,
  order: number,
): AcceptMediaRange | null => {
  const parts = splitOutsideQuotes(value, ";");
  if (parts === null) return null;

  const mediaType = parts.shift()?.trim().toLowerCase() ?? "";
  const mediaTypeParts = mediaType.split("/");
  if (mediaTypeParts.length !== 2) return null;
  const [type = "", subtype = ""] = mediaTypeParts;
  if (
    !(type === "*" || (httpToken.test(type) && !type.includes("*"))) ||
    !(subtype === "*" || (httpToken.test(subtype) && !subtype.includes("*"))) ||
    (type === "*" && subtype !== "*")
  ) {
    return null;
  }

  let mediaParameterCount = 0;
  let quality = 1;
  let qualitySeen = false;
  for (const rawParameter of parts) {
    const parameter = rawParameter.trim();
    const equals = parameter.indexOf("=");
    const name = (equals === -1 ? parameter : parameter.slice(0, equals))
      .trim()
      .toLowerCase();
    const parameterValue =
      equals === -1 ? null : parameter.slice(equals + 1).trim();
    if (!httpToken.test(name)) return null;

    if (name === "q") {
      if (
        qualitySeen ||
        parameterValue === null ||
        !httpQuality.test(parameterValue)
      ) {
        return null;
      }
      quality = Number(parameterValue);
      qualitySeen = true;
    } else if (!qualitySeen) {
      if (parameterValue === null || !validParameterValue(parameterValue)) {
        return null;
      }
      mediaParameterCount += 1;
    } else if (
      parameterValue !== null &&
      !validParameterValue(parameterValue)
    ) {
      return null;
    }
  }

  return { type, subtype, mediaParameterCount, quality, order };
};

const requestedMediaRanges = (
  accept: Exclude<MidnightDIDResolutionOptions["accept"], undefined>,
): AcceptMediaRange[] => {
  const values = typeof accept === "string" ? [accept] : [...accept];
  const ranges: AcceptMediaRange[] = [];
  let order = 0;

  for (const value of values) {
    const entries = splitOutsideQuotes(value, ",");
    if (entries === null) continue;
    for (const entry of entries) {
      const range = parseAcceptMediaRange(entry.trim(), order);
      if (range !== null) ranges.push(range);
      order += 1;
    }
  }
  return ranges;
};

const matchingSpecificity = (
  range: AcceptMediaRange,
  representation: DIDDocumentRepresentationMediaTypes,
): number => {
  if (range.mediaParameterCount !== 0) return -1;
  const [type, subtype] = representation.split("/") as [string, string];
  if (range.type === type && range.subtype === subtype) return 2;
  if (range.type === type && range.subtype === "*") return 1;
  if (range.type === "*" && range.subtype === "*") return 0;
  return -1;
};

const selectRepresentationMediaType = (
  accept: MidnightDIDResolutionOptions["accept"],
): DIDDocumentRepresentationMediaTypes | null => {
  if (
    accept === undefined ||
    (Array.isArray(accept) && accept.every((value) => value.trim() === "")) ||
    (typeof accept === "string" && accept.trim() === "")
  ) {
    return "application/did+ld+json";
  }

  const ranges = requestedMediaRanges(accept);
  let selected:
    | {
        representation: DIDDocumentRepresentationMediaTypes;
        quality: number;
        requestOrder: number;
      }
    | undefined;

  for (const representation of supportedRepresentationMediaTypes) {
    let effectiveRange: AcceptMediaRange | undefined;
    let effectiveSpecificity = -1;
    for (const range of ranges) {
      const specificity = matchingSpecificity(range, representation);
      if (specificity > effectiveSpecificity) {
        effectiveRange = range;
        effectiveSpecificity = specificity;
      }
    }

    if (effectiveRange === undefined || effectiveRange.quality === 0) continue;
    if (
      selected === undefined ||
      effectiveRange.quality > selected.quality ||
      (effectiveRange.quality === selected.quality &&
        effectiveRange.order < selected.requestOrder)
    ) {
      selected = {
        representation,
        quality: effectiveRange.quality,
        requestOrder: effectiveRange.order,
      };
    }
  }

  return selected?.representation ?? null;
};

const documentForRepresentation = (
  didDocument: MidnightDIDDocument,
  contentType?: DIDDocumentRepresentationMediaTypes,
): MidnightDIDDocument => {
  if (contentType !== "application/did+json") return didDocument;

  const didJsonDocument = { ...didDocument };
  Reflect.deleteProperty(didJsonDocument, "@context");
  return didJsonDocument;
};

const representationEnvelope = (
  result: MidnightResolutionResult | null,
  contentType?: DIDDocumentRepresentationMediaTypes,
  error?: DIDResolutionErrorCode,
): MidnightDIDRepresentationResult => ({
  didDocumentStream:
    result === null || result === undefined
      ? null
      : new TextEncoder().encode(
          JSON.stringify(
            documentForRepresentation(result.didDocument, contentType),
          ),
        ),
  didDocumentMetadata: result?.didDocumentMetadata ?? {},
  didResolutionMetadata: {
    ...(contentType === undefined ? {} : { contentType }),
    ...(error === undefined ? {} : { error }),
  },
});

export class MidnightDIDResolver implements MidnightDIDResolverInterface {
  private readonly ledgerReader: MidnightLedgerReader;
  private readonly expectedNetwork: MidnightNetwork | null;

  constructor(options: MidnightDIDResolverOptions) {
    this.ledgerReader = options.ledgerReader;
    this.expectedNetwork = options.expectedNetwork ?? null;
  }

  async resolve(did: string): Promise<MidnightDIDDocument> {
    const result = await this.resolveResult(did);
    if (result === null) {
      throw new Error(`DID not found: ${did}`);
    }
    return result.didDocument;
  }

  async resolveResult(did: string): Promise<MidnightResolutionResult | null> {
    let parsed: ReturnType<typeof parseMidnightDIDString>;
    try {
      parsed = parseMidnightDIDString(did);
    } catch (error) {
      throw new ResolverRequestError(
        `Invalid DID: ${did}`,
        "invalidDid",
        error,
      );
    }
    const { network, id } = parseMidnightDID(parsed);

    if (network === MidnightNetwork.Offchain) {
      throw new ResolverRequestError(
        "Offchain Midnight DIDs must be resolved from their long-form encoded state, not through the ledger resolver",
        "methodNotSupported",
      );
    }

    if (this.expectedNetwork !== null && network !== this.expectedNetwork) {
      throw new ResolverRequestError(
        `Network mismatch: DID network is ${network}, expected ${this.expectedNetwork}`,
        "methodNotSupported",
      );
    }

    const contractAddress = id as ContractAddress;
    const ledgerState = await this.ledgerReader(contractAddress);
    if (ledgerState === null) return null;

    let didDocument: MidnightDIDDocument;
    try {
      didDocument = LedgerToDomain.ledgerStateToDIDDocument(
        ledgerState,
        network,
        contractAddress,
      );
    } catch (error) {
      if (ledgerDocumentResolutionCode(error) !== null) {
        throw invalidDidDocumentError(error);
      }
      throw error;
    }

    return {
      didDocument,
      didDocumentMetadata: LedgerToDomain.ledgerStateToMetadata(ledgerState),
    };
  }

  async resolveDIDResolutionResult(
    did: string,
  ): Promise<MidnightDIDResolutionResult> {
    try {
      const result = await this.resolveResult(did);
      return resolutionEnvelope(
        result,
        result === null ? "notFound" : undefined,
      );
    } catch (error) {
      return resolutionEnvelope(null, resolutionErrorCode(error));
    }
  }

  async resolveRepresentation(
    did: string,
    options: MidnightDIDResolutionOptions = {},
  ): Promise<MidnightDIDRepresentationResult> {
    const contentType = selectRepresentationMediaType(options.accept);
    if (contentType === null) {
      return representationEnvelope(
        null,
        undefined,
        "representationNotSupported",
      );
    }

    try {
      const result = await this.resolveResult(did);
      return result === null
        ? representationEnvelope(null, undefined, "notFound")
        : representationEnvelope(result, contentType);
    } catch (error) {
      return representationEnvelope(
        null,
        undefined,
        resolutionErrorCode(error),
      );
    }
  }
}
