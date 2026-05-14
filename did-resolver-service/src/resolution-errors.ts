export type ResolutionErrorCode =
  | "notFound"
  | "invalidDid"
  | "networkMismatch"
  | "internalError";

export class ResolverInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ResolverInputError";
  }
}

export class ResolutionRequestTimeoutError extends Error {
  public constructor(timeoutMs: number) {
    super(`DID resolution timed out after ${timeoutMs.toString()}ms`);
    this.name = "ResolutionRequestTimeoutError";
  }
}

const midnightDidInputErrorMessages = [
  "Invalid Midnight DID format",
  "Unknown network in Midnight DID",
  "Invalid contract address in Midnight DID",
] as const;

export const classifyResolutionError = (
  error: unknown,
): ResolutionErrorCode => {
  const message =
    error instanceof Error ? error.message : "Unexpected resolve error";

  if (error instanceof ResolverInputError) {
    return "invalidDid";
  }
  if (
    midnightDidInputErrorMessages.some((needle) => message.includes(needle))
  ) {
    return "invalidDid";
  }
  if (message.includes("Network mismatch")) {
    return "networkMismatch";
  }
  return "internalError";
};

export const statusCodeForResolutionError = (
  errorCode: ResolutionErrorCode,
): 200 | 500 => {
  if (errorCode === "internalError") return 500;
  return 200;
};
