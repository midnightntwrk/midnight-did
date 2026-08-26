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

const requestedMediaTypes = (
  accept: MidnightDIDResolutionOptions["accept"],
): string[] => {
  if (accept === undefined) return [];
  const values = (typeof accept === "string" ? [accept] : [...accept]).flatMap(
    (value) => value.split(","),
  );
  return values
    .map((value) => {
      const [mediaType, ...parameters] = value.split(";");
      const quality = parameters.find((parameter) =>
        /^\s*q\s*=/i.test(parameter),
      );
      const qualityValue = quality?.split("=", 2)[1]?.trim();
      return {
        mediaType: mediaType?.trim().toLowerCase() ?? "",
        quality: qualityValue === undefined ? 1 : Number(qualityValue),
      };
    })
    .filter(({ mediaType, quality }) => mediaType !== "" && quality > 0)
    .sort((left, right) => right.quality - left.quality)
    .map(({ mediaType }) => mediaType);
};

const selectRepresentationMediaType = (
  accept: MidnightDIDResolutionOptions["accept"],
): DIDDocumentRepresentationMediaTypes | null => {
  if (
    accept === undefined ||
    (Array.isArray(accept) && accept.length === 0) ||
    (typeof accept === "string" && accept.trim() === "")
  ) {
    return "application/did+ld+json";
  }

  const requested = requestedMediaTypes(accept);
  if (requested.length === 0) {
    return null;
  }

  for (const value of requested) {
    if (value === "*/*") return "application/did+ld+json";
    if (
      supportedRepresentationMediaTypes.includes(
        value as DIDDocumentRepresentationMediaTypes,
      )
    ) {
      return value as DIDDocumentRepresentationMediaTypes;
    }
  }

  return null;
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
