export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly recoverable: boolean;
  public readonly suggestedAction?: string;

  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity = 'MEDIUM',
    recoverable: boolean = true,
    suggestedAction?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.recoverable = recoverable;
    this.suggestedAction = suggestedAction;
    Error.captureStackTrace(this, this.constructor);
  }
}
