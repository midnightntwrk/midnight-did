/**
 * Common base for API errors with stable, machine-readable string codes.
 */
export class MidnightDidApiError<Code extends string> extends Error {
  constructor(
    readonly code: Code,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MidnightDidApiError";
  }
}
