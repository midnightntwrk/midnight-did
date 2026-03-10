export class SecretStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretStoreError";
  }
}

export class SecretStoreInitError extends SecretStoreError {
  constructor(message: string) {
    super(message);
    this.name = "SecretStoreInitError";
  }
}

export class SecretStoreLockedError extends SecretStoreError {
  constructor(message = "Secret store requires a passphrase") {
    super(message);
    this.name = "SecretStoreLockedError";
  }
}

export class SecretNotFoundError extends SecretStoreError {
  constructor(keyRef: string) {
    super(`Secret not found: ${keyRef}`);
    this.name = "SecretNotFoundError";
  }
}

export class UnsupportedCurveError extends SecretStoreError {
  constructor(curve: string) {
    super(`Unsupported curve: ${curve}`);
    this.name = "UnsupportedCurveError";
  }
}

export class SigningNotSupportedError extends SecretStoreError {
  constructor(curve: string) {
    super(`Signing is not supported for curve ${curve} in this implementation`);
    this.name = "SigningNotSupportedError";
  }
}

export class VerificationFailedError extends SecretStoreError {
  constructor(message = "Signature verification failed") {
    super(message);
    this.name = "VerificationFailedError";
  }
}
