export type ResolutionErrorCode =
  | "notFound"
  | "invalidDid"
  | "networkMismatch"
  | "internalError";

const didInputErrorMessages = [
  "Invalid Midnight DID format",
  "Unknown network in Midnight DID",
  "Invalid contract address in Midnight DID",
  "indexerUrl must use http or https",
  "indexerWsUrl must use ws or wss",
  "not in MIDNIGHT_INDEXER_ALLOWLIST",
  "Invalid URL",
] as const;

export const classifyResolutionError = (
  error: unknown,
): ResolutionErrorCode => {
  const message =
    error instanceof Error ? error.message : "Unexpected resolve error";

  if (didInputErrorMessages.some((needle) => message.includes(needle))) {
    return "invalidDid";
  }
  if (message.includes("Network mismatch")) {
    return "networkMismatch";
  }
  return "internalError";
};

export const statusCodeForResolutionError = (
  errorCode: ResolutionErrorCode,
): 400 | 404 | 500 => {
  if (errorCode === "internalError") return 500;
  if (errorCode === "notFound") return 404;
  return 400;
};
