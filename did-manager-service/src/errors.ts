type ManagerHttpError = {
  statusCode: number;
  errorCode: string;
  message: string;
};

const zodLikeMessage = (error: unknown): string | null => {
  if (
    typeof error !== "object" ||
    error === null ||
    !("issues" in error) ||
    !Array.isArray((error as { issues?: unknown[] }).issues)
  ) {
    return null;
  }

  const messages = (error as { issues: Array<{ message?: unknown }> }).issues
    .map((issue) => (typeof issue.message === "string" ? issue.message : null))
    .filter((message): message is string => message !== null);

  if (messages.length === 0) return null;
  return Array.from(new Set(messages)).join("; ");
};

const upstreamFailurePatterns = [
  "ECONNREFUSED",
  "timed out",
  "Resolution timed out",
  "fetch failed",
  "socket hang up",
];

export const classifyManagerHttpError = (error: unknown): ManagerHttpError => {
  const zodMessage = zodLikeMessage(error);
  const message =
    zodMessage ??
    (error instanceof Error ? error.message : "Unexpected manager error");
  const errorName = error instanceof Error ? error.name : "Error";
  const fastifyValidationError =
    typeof error === "object" &&
    error !== null &&
    "validation" in error &&
    Array.isArray((error as { validation?: unknown[] }).validation);

  if (fastifyValidationError) {
    return {
      statusCode: 400,
      errorCode: "invalidRequest",
      message,
    };
  }

  if (zodMessage !== null || errorName === "ZodError") {
    return {
      statusCode: 400,
      errorCode: "invalidSeed",
      message,
    };
  }

  if (message.startsWith("Seed ")) {
    return {
      statusCode: 400,
      errorCode: "invalidSeed",
      message,
    };
  }

  if (errorName === "SecretNotFoundError") {
    return {
      statusCode: 404,
      errorCode: "secretNotFound",
      message,
    };
  }

  if (errorName === "SecretStoreLockedError") {
    return {
      statusCode: 400,
      errorCode: "secretStoreLocked",
      message,
    };
  }

  if (upstreamFailurePatterns.some((pattern) => message.includes(pattern))) {
    return {
      statusCode: 503,
      errorCode: "upstreamUnavailable",
      message,
    };
  }

  if (message.includes("Session is locked") || message.includes("Session is closed")) {
    return {
      statusCode: 409,
      errorCode: "sessionLocked",
      message,
    };
  }

  if (message.startsWith("Another operation is already running")) {
    return {
      statusCode: 409,
      errorCode: "operationBusy",
      message,
    };
  }

  if (message.startsWith("Operation not found:")) {
    return {
      statusCode: 404,
      errorCode: "operationNotFound",
      message,
    };
  }

  if (
    message.includes("Profile name") ||
    message.includes("No stored seed") ||
    message.includes("Funding is not prepared") ||
    message.includes("does not match the prepared funding seed") ||
    message.includes("Prepared funding state is inconsistent") ||
    message.includes("Seed mode generated is not allowed for Start session") ||
    message.includes("verificationMethod") ||
    message.includes("serviceEndpoint") ||
    message.includes("relation ")
  ) {
    return {
      statusCode: 400,
      errorCode: "invalidRequest",
      message,
    };
  }

  if (message.includes("was not found on")) {
    return {
      statusCode: 404,
      errorCode: "contractNotFound",
      message,
    };
  }

  return {
    statusCode: 500,
    errorCode: "internalError",
    message,
  };
};
