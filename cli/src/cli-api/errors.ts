export class CliServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliServiceError';
  }
}

export class CliTransitionError extends CliServiceError {
  readonly fix?: string;

  constructor(message: string, fix?: string) {
    super(message);
    this.name = 'CliTransitionError';
    this.fix = fix;
  }
}
